import type {
  CreateMessageInput,
  MessageMention,
  MessageHistoryQuery,
  UpdateMessageInput,
} from "@intouch/shared/messages";
import {
  ChannelKind,
  ConversationType,
  ConversationVisibility,
} from "@intouch/shared/conversations";
import { NotificationType } from "@intouch/shared/notifications";

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
import type { UserRepository } from "../user/user.repository.js";
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
  users?: Pick<UserRepository, "findPublicByIds">;
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
  users = { findPublicByIds: () => Promise.resolve([]) },
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

  const decorateReplies = async <
    T extends import("./message.types.js").MessageRecord,
  >(
    records: readonly T[],
  ): Promise<T[]> => {
    const replyIds = [
      ...new Set(
        records.flatMap(({ replyToMessageId }) =>
          replyToMessageId ? [replyToMessageId] : [],
        ),
      ),
    ];
    const replyMessages = messages.findByIds
      ? await messages.findByIds(replyIds)
      : [];
    const senders = await users.findPublicByIds([
      ...new Set(replyMessages.map(({ senderId }) => senderId)),
    ]);
    const repliesById = new Map(
      replyMessages.map((message) => [message.id, message]),
    );
    const sendersById = new Map(senders.map((sender) => [sender.id, sender]));

    return records.map((record) => {
      const reply = record.replyToMessageId
        ? repliesById.get(record.replyToMessageId)
        : undefined;
      const sender = reply ? sendersById.get(reply.senderId) : undefined;
      if (!reply || !sender) return { ...record, replyTo: null };

      return {
        ...record,
        replyTo: {
          id: reply.id,
          sender: {
            id: sender.id,
            username: sender.username,
            displayName: sender.displayName,
            avatarAssetId: sender.avatarAssetId ?? null,
            ...(sender.avatarUrl ? { avatarUrl: sender.avatarUrl } : {}),
          },
          content: reply.deletedAt
            ? null
            : (reply.content?.slice(0, 160) ?? null),
          messageType: reply.messageType,
          deletedAt: reply.deletedAt,
        },
      };
    });
  };

  const decorate = async <T extends import("./message.types.js").MessageRecord>(
    userId: string,
    conversation: Awaited<ReturnType<typeof conversations.getAccessible>>,
    records: readonly T[],
  ) =>
    reactions.decorate(
      userId,
      conversation,
      await decorateReplies(
        await calls.decorateMessages(
          await uploads.decorate(
            records.map((record) => ({
              ...record,
              mentions: record.mentions ?? [],
            })),
          ),
        ),
      ),
    );

  const validateMentions = async (
    context: import("../organizations/organization.unit-of-work.js").OrganizationWorkContext,
    conversation: Awaited<ReturnType<typeof conversations.getAccessible>>,
    content: string | null | undefined,
    mentions: readonly MessageMention[],
  ) => {
    if (mentions.length === 0) return [];
    if (!content) throw new MessageValidationError("Mentions require content");
    const userIds = [...new Set(mentions.map(({ userId }) => userId))];
    const [memberships, mentionedUsers] = await Promise.all([
      context.memberships.listForOrganization(conversation.organizationId),
      context.users?.findPublicByIds(userIds) ?? Promise.resolve([]),
    ]);
    const memberIds = new Set(memberships.map(({ userId }) => userId));
    const usersById = new Map(mentionedUsers.map((user) => [user.id, user]));
    let allowedIds = memberIds;
    if (
      conversation.type === ConversationType.DIRECT ||
      conversation.visibility === ConversationVisibility.PRIVATE
    ) {
      const participants =
        await context.conversationParticipants.listByConversation(
          conversation.id,
        );
      allowedIds = new Set(participants.map(({ userId }) => userId));
    }
    for (const mention of mentions) {
      const mentionedUser = usersById.get(mention.userId);
      if (
        !mentionedUser ||
        !memberIds.has(mention.userId) ||
        !allowedIds.has(mention.userId) ||
        content.slice(mention.start, mention.end) !==
          `@${mentionedUser.displayName}`
      ) {
        throw new MessageValidationError("Invalid message mention");
      }
    }
    return userIds;
  };

  const createChannelNotifications = async (
    context: import("../organizations/organization.unit-of-work.js").OrganizationWorkContext,
    input: {
      actorUserId: string;
      conversation: Awaited<ReturnType<typeof conversations.getAccessible>>;
      messageId: string;
      messageCreatedAt: Date;
      mentionUserIds: readonly string[];
      replyRecipientUserId?: string;
    },
  ) => {
    if (input.conversation.type !== ConversationType.CHANNEL) return [];
    const notifications = [];
    let replyRecipient =
      input.replyRecipientUserId !== input.actorUserId
        ? input.replyRecipientUserId
        : undefined;
    if (replyRecipient) {
      const membership = await context.memberships.findForUser(
        replyRecipient,
        input.conversation.organizationId,
      );
      if (!membership) {
        replyRecipient = undefined;
      } else if (
        input.conversation.visibility === ConversationVisibility.PRIVATE
      ) {
        const participants =
          await context.conversationParticipants.listByConversation(
            input.conversation.id,
          );
        if (!participants.some(({ userId }) => userId === replyRecipient)) {
          replyRecipient = undefined;
        }
      }
    }
    if (replyRecipient) {
      notifications.push(
        await context.notifications.create({
          recipientUserId: replyRecipient,
          actorUserId: input.actorUserId,
          organizationId: input.conversation.organizationId,
          type: NotificationType.MESSAGE_REPLY_RECEIVED,
          dedupeKey: `reply:${input.messageId}:${replyRecipient}`,
          conversationId: input.conversation.id,
          conversationType: ConversationType.CHANNEL,
          messageId: input.messageId,
          lastActivityAt: input.messageCreatedAt,
          expiresAt: new Date(
            input.messageCreatedAt.getTime() + NOTIFICATION_RETENTION_MS,
          ),
        }),
      );
    }
    for (const recipientUserId of new Set(input.mentionUserIds)) {
      if (
        recipientUserId === input.actorUserId ||
        recipientUserId === replyRecipient
      ) {
        continue;
      }
      notifications.push(
        await context.notifications.create({
          recipientUserId,
          actorUserId: input.actorUserId,
          organizationId: input.conversation.organizationId,
          type: NotificationType.CHANNEL_MENTION_RECEIVED,
          dedupeKey: `mention:${input.messageId}:${recipientUserId}`,
          conversationId: input.conversation.id,
          conversationType: ConversationType.CHANNEL,
          messageId: input.messageId,
          lastActivityAt: input.messageCreatedAt,
          expiresAt: new Date(
            input.messageCreatedAt.getTime() + NOTIFICATION_RETENTION_MS,
          ),
        }),
      );
    }
    return notifications;
  };

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
        const mentionUserIds = await validateMentions(
          context,
          conversation,
          input.content,
          input.mentions ?? [],
        );
        const replyTarget = input.replyToMessageId
          ? await context.messages.findById(input.replyToMessageId)
          : null;
        if (
          input.replyToMessageId &&
          (!replyTarget || replyTarget.conversationId !== conversationId)
        ) {
          throw new MessageValidationError("Invalid reply target");
        }
        const created = await context.messages.create({
          conversationId,
          senderId: userId,
          content: input.content ?? null,
          messageType:
            uploadIds.length > 0 ? MessageType.ATTACHMENT : MessageType.TEXT,
          ...(input.replyToMessageId
            ? { replyToMessageId: input.replyToMessageId }
            : {}),
          mentions: input.mentions ?? [],
          notifiedMentionUserIds: mentionUserIds,
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
        const createdNotifications = [];
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
            createdNotifications.push(
              await context.notifications.upsertDirectMessage({
                recipientUserId: recipient.userId,
                actorUserId: userId,
                organizationId: conversation.organizationId,
                conversationId: conversation.id,
                latestMessageId: created.id,
                lastActivityAt: created.createdAt,
                expiresAt: new Date(
                  created.createdAt.getTime() + NOTIFICATION_RETENTION_MS,
                ),
              }),
            );
          }
        } else {
          createdNotifications.push(
            ...(await createChannelNotifications(context, {
              actorUserId: userId,
              conversation,
              messageId: created.id,
              messageCreatedAt: created.createdAt,
              mentionUserIds,
              ...(replyTarget
                ? { replyRecipientUserId: replyTarget.senderId }
                : {}),
            })),
          );
        }
        return {
          conversation,
          message: created,
          notifications: createdNotifications,
        };
      });
      const [message] = await decorate(userId, result.conversation, [
        result.message,
      ]);
      if (!message) throw new MessageNotFoundError();
      broadcaster.messageCreated(message);
      await activity.messageCreated(result.conversation, userId);
      for (const notification of result.notifications) {
        await notificationDelivery.publishUpsert(notification);
      }
      return message;
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
        conversationPolicy.assertMessageEditable(existing, userId);
        if (
          input.content === null &&
          existing.messageType === MessageType.TEXT
        ) {
          throw new MessageValidationError(
            "A text-only message cannot have an empty caption",
          );
        }
        const mentionUserIds = await validateMentions(
          context,
          conversation,
          input.content,
          input.mentions ?? [],
        );
        const newlyMentioned = mentionUserIds.filter(
          (mentionedUserId) =>
            !(existing.notifiedMentionUserIds ?? []).includes(mentionedUserId),
        );
        const notifiedMentionUserIds = [
          ...new Set([
            ...(existing.notifiedMentionUserIds ?? []),
            ...mentionUserIds,
          ]),
        ];
        const message = await context.messages.updateContent(
          messageId,
          input.content,
          input.mentions ?? [],
          notifiedMentionUserIds,
          new Date(),
        );
        if (!message) throw new MessageNotFoundError();
        const createdNotifications = await createChannelNotifications(context, {
          actorUserId: userId,
          conversation,
          messageId,
          messageCreatedAt: message.updatedAt,
          mentionUserIds: newlyMentioned,
        });
        return { conversation, message, notifications: createdNotifications };
      });
      const [decorated] = await decorate(userId, result.conversation, [
        result.message,
      ]);
      if (!decorated) throw new MessageNotFoundError();
      broadcaster.messageUpdated(decorated);
      await activity.messageUpdated(result.conversation, userId);
      for (const notification of result.notifications) {
        await notificationDelivery.publishUpsert(notification);
      }
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
