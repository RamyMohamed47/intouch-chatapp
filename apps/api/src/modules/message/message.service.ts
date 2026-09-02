import type {
  CreateMessageInput,
  MessageHistoryQuery,
  UpdateMessageInput,
} from "@intouch/shared/messages";
import { ChannelKind, ConversationType } from "@intouch/shared/conversations";

import type { MessageBroadcaster } from "../../broadcasting/messageBroadcaster.js";
import type { ConversationActivityService } from "../conversation-activity/index.js";
import type { ConversationService } from "../conversations/conversation.service.js";
import { ConversationNotFoundError } from "../conversations/conversation.errors.js";
import { ConversationConflictError } from "../conversations/conversation.errors.js";
import type { ConversationPolicy } from "../conversations/conversation.policy.js";
import type { MessageReactionService } from "../message-reactions/index.js";
import type { NotificationService } from "../notifications/index.js";
import type { OrganizationUnitOfWork } from "../organizations/organization.unit-of-work.js";
import type { UploadService } from "../uploads/index.js";
import { UploadConflictError } from "../uploads/upload.errors.js";
import {
  MessageNotFoundError,
  MessageValidationError,
} from "./message.errors.js";
import type { MessageRepository } from "./message.repository.js";
import { MessageType, type MessagePage } from "./message.types.js";

export interface MessageServiceDependencies {
  activity: Pick<
    ConversationActivityService,
    "messageCreated" | "messageDeleted" | "messageUpdated"
  >;
  broadcaster: MessageBroadcaster;
  conversationPolicy: Pick<
    ConversationPolicy,
    "assertMessageDeletable" | "assertMessageEditable"
  >;
  conversations: Pick<
    ConversationService,
    "getAccessible" | "getAccessibleInContext"
  >;
  messages: MessageRepository;
  reactions: Pick<MessageReactionService, "decorate">;
  calls?: {
    decorateMessages<T extends import("./message.types.js").MessageRecord>(
      records: readonly T[],
    ): Promise<
      (T & { call?: import("@intouch/shared/voice").CallSummaryDto | null })[]
    >;
  };
  uploads?: Pick<UploadService, "decorate">;
  unitOfWork: OrganizationUnitOfWork;
  notificationDelivery?: Pick<
    NotificationService,
    "publishDeleted" | "publishUpsert"
  >;
}

const NOTIFICATION_RETENTION_MS = 30 * 24 * 60 * 60 * 1000;

const createMessageService = ({
  activity,
  broadcaster,
  conversationPolicy,
  conversations,
  messages,
  reactions,
  calls = {
    decorateMessages: <T extends import("./message.types.js").MessageRecord>(
      records: readonly T[],
    ) => Promise.resolve([...records]),
  },
  uploads = {
    decorate: <T extends { id: string }>(records: readonly T[]) =>
      Promise.resolve(
        records.map((record) => ({ ...record, attachments: [] })),
      ),
  },
  unitOfWork,
  notificationDelivery = {
    publishDeleted: () => undefined,
    publishUpsert: () => Promise.resolve(),
  },
}: MessageServiceDependencies) => {
  const assertMessageConversation = (conversation: {
    type: string;
    kind?: string;
  }) => {
    if (
      conversation.type === ConversationType.CHANNEL &&
      conversation.kind === ChannelKind.VOICE
    ) {
      throw new ConversationConflictError(
        "Voice channels do not support messages",
      );
    }
  };

  const decorate = async <T extends import("./message.types.js").MessageRecord>(
    userId: string,
    conversation: Awaited<ReturnType<typeof conversations.getAccessible>>,
    records: readonly T[],
  ) =>
    reactions.decorate(
      userId,
      conversation,
      await calls.decorateMessages(await uploads.decorate(records)),
    );

  return {
    async list(
      userId: string,
      conversationId: string,
      query: MessageHistoryQuery,
    ): Promise<MessagePage> {
      const conversation = await conversations.getAccessible(
        userId,
        conversationId,
      );
      assertMessageConversation(conversation);
      const records = await messages.listByConversation(
        conversationId,
        query.before,
        query.limit + 1,
      );
      const hasMore = records.length > query.limit;
      const page = hasMore ? records.slice(0, query.limit) : records;
      return {
        messages: await decorate(userId, conversation, page),
        nextCursor: hasMore ? (page.at(-1)?.id ?? null) : null,
      };
    },

    async create(
      userId: string,
      conversationId: string,
      input: CreateMessageInput,
    ) {
      const result = await unitOfWork.run(async (context) => {
        const conversation = await conversations.getAccessibleInContext(
          userId,
          conversationId,
          context,
        );
        assertMessageConversation(conversation);
        if (
          !(await context.organizations.lockForMutation(
            conversation.organizationId,
          ))
        ) {
          throw new ConversationNotFoundError();
        }
        const uploadIds = input.uploadIds ?? [];
        const created = await context.messages.create({
          conversationId,
          senderId: userId,
          content: input.content ?? null,
          messageType:
            uploadIds.length > 0 ? MessageType.ATTACHMENT : MessageType.TEXT,
        });
        const claimed = await context.assets.claimForMessage({
          assetIds: uploadIds,
          ownerUserId: userId,
          conversationId,
          messageId: created.id,
          now: new Date(),
        });
        if (
          claimed.length !== uploadIds.length ||
          claimed.some((asset) => !uploadIds.includes(asset.id))
        ) {
          throw new UploadConflictError();
        }
        if (
          !(await context.conversations.touchActivity(
            conversationId,
            created.createdAt,
          ))
        ) {
          throw new ConversationNotFoundError();
        }
        let notification = null;
        if (conversation.type === ConversationType.DIRECT) {
          const participants =
            await context.conversationParticipants.listByConversation(
              conversation.id,
            );
          const recipient = participants.find(
            ({ userId: participantUserId }) => participantUserId !== userId,
          );
          const recipientMembership = recipient
            ? await context.memberships.findForUser(
                recipient.userId,
                conversation.organizationId,
              )
            : null;
          if (recipient && recipientMembership) {
            notification = await context.notifications.upsertDirectMessage({
              recipientUserId: recipient.userId,
              actorUserId: userId,
              organizationId: conversation.organizationId,
              conversationId: conversation.id,
              latestMessageId: created.id,
              lastActivityAt: created.createdAt,
              expiresAt: new Date(
                created.createdAt.getTime() + NOTIFICATION_RETENTION_MS,
              ),
            });
          }
        }
        return { conversation, message: created, notification };
      });
      const [message] = await calls.decorateMessages(
        await uploads.decorate([result.message]),
      );
      if (!message) throw new MessageNotFoundError();
      broadcaster.messageCreated(message);
      await activity.messageCreated(result.conversation, userId);
      if (result.notification) {
        await notificationDelivery.publishUpsert(result.notification);
      }
      return {
        ...message,
        reactions: [],
        currentUserReaction: null,
      };
    },

    async context(userId: string, conversationId: string, messageId: string) {
      const conversation = await conversations.getAccessible(
        userId,
        conversationId,
      );
      assertMessageConversation(conversation);
      const context = await messages.listContext(conversationId, messageId, 20);
      if (!context.messages.some(({ id }) => id === messageId)) {
        throw new MessageNotFoundError();
      }
      return {
        anchorMessageId: messageId,
        messages: await decorate(userId, conversation, context.messages),
        hasEarlier: context.hasEarlier,
        hasLater: context.hasLater,
      };
    },

    async update(userId: string, messageId: string, input: UpdateMessageInput) {
      const existing = await messages.findById(messageId);
      if (!existing) throw new MessageNotFoundError();
      const conversation = await conversations.getAccessible(
        userId,
        existing.conversationId,
      );
      assertMessageConversation(conversation);
      if (existing.messageType === MessageType.CALL) {
        throw new MessageValidationError("Call timeline entries are immutable");
      }
      conversationPolicy.assertMessageEditable(existing, userId);
      const [existingWithAttachments] = await uploads.decorate([existing]);
      if (!existingWithAttachments) throw new MessageNotFoundError();
      if (
        input.content === null &&
        existingWithAttachments.attachments.length === 0
      ) {
        throw new MessageValidationError(
          "A text-only message cannot have an empty caption",
        );
      }
      const message = await messages.updateContent(
        messageId,
        input.content,
        new Date(),
      );
      if (!message) throw new MessageNotFoundError();
      const [withAttachments] = await uploads.decorate([message]);
      if (!withAttachments) throw new MessageNotFoundError();
      broadcaster.messageUpdated(withAttachments);
      await activity.messageUpdated(conversation, userId);
      const [decorated] = await decorate(userId, conversation, [
        withAttachments,
      ]);
      if (!decorated) throw new MessageNotFoundError();
      return decorated;
    },

    async delete(userId: string, messageId: string) {
      const result = await unitOfWork.run(async (context) => {
        const existing = await context.messages.findById(messageId);
        if (!existing) throw new MessageNotFoundError();
        const conversation = await conversations.getAccessibleInContext(
          userId,
          existing.conversationId,
          context,
        );
        assertMessageConversation(conversation);
        if (existing.messageType === MessageType.CALL) {
          throw new MessageValidationError(
            "Call timeline entries are immutable",
          );
        }
        const membership = await context.memberships.findForUser(
          userId,
          conversation.organizationId,
        );
        conversationPolicy.assertMessageDeletable(
          existing,
          conversation,
          userId,
          membership,
        );
        if (existing.deletedAt) return null;
        if (
          !(await context.organizations.lockForMutation(
            conversation.organizationId,
          ))
        ) {
          throw new MessageNotFoundError();
        }
        const message = await context.messages.redact(messageId, new Date());
        if (!message) throw new MessageNotFoundError();
        await context.messageReactions.deleteByMessageId(messageId);
        await context.assets.markMessageAssetsForDeletion(messageId);
        const removedNotifications =
          await context.notifications.deleteByMessageId(messageId);
        return { conversation, message, removedNotifications };
      });
      if (!result) return;
      broadcaster.messageDeleted({ ...result.message, attachments: [] });
      await activity.messageDeleted(result.conversation, userId);
      for (const notification of result.removedNotifications) {
        notificationDelivery.publishDeleted(notification);
      }
    },
  };
};

export type MessageService = ReturnType<typeof createMessageService>;
export default createMessageService;
