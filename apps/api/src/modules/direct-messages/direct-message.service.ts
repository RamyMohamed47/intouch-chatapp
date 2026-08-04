import {
  ConversationType,
  type CreateDirectMessageInput,
  type ListDirectMessagesQuery,
} from "@intouch/shared/conversations";

import ConflictError from "../../errors/ConflictError.js";
import ValidationError from "../../errors/ValidationError.js";
import { ParticipantPersistenceConflictError } from "../conversations/conversation-participant.repository.js";
import type { ConversationRepository } from "../conversations/conversation.repository.js";
import { ConversationPersistenceConflictError } from "../conversations/conversation.repository.js";
import type { ConversationService } from "../conversations/conversation.service.js";
import type { ConversationSummary } from "../conversations/conversation.types.js";
import type { MembershipService } from "../memberships/index.js";
import type { OrganizationPolicy } from "../organizations/organization.policy.js";
import { OrganizationNotFoundError } from "../organizations/organization.errors.js";
import type { OrganizationRepository } from "../organizations/organization.repository.js";
import type { OrganizationUnitOfWork } from "../organizations/organization.unit-of-work.js";
import { DirectMessageRecipientNotFoundError } from "./direct-message.errors.js";

interface DirectMessageCursor {
  at: string;
  id: string;
}

export interface DirectMessageServiceDependencies {
  conversations: ConversationRepository;
  memberships: MembershipService;
  organizations: OrganizationRepository;
  organizationPolicy: OrganizationPolicy;
  summaries: Pick<ConversationService, "summarize">;
  unitOfWork: OrganizationUnitOfWork;
}

const buildParticipantPair = (leftUserId: string, rightUserId: string) => {
  const [directParticipantAId, directParticipantBId] = [
    leftUserId,
    rightUserId,
  ].sort();
  if (!directParticipantAId || !directParticipantBId) {
    throw new Error("Direct-message participant pair is incomplete");
  }
  return {
    directParticipantAId,
    directParticipantBId,
    directParticipantKey: `${directParticipantAId}:${directParticipantBId}`,
  };
};

const buildParticipantKey = (leftUserId: string, rightUserId: string) =>
  buildParticipantPair(leftUserId, rightUserId).directParticipantKey;

const activityTime = (conversation: ConversationSummary) =>
  conversation.lastMessage?.createdAt ?? conversation.createdAt;

const encodeCursor = (conversation: ConversationSummary) =>
  Buffer.from(
    JSON.stringify({
      at: activityTime(conversation).toISOString(),
      id: conversation.id,
    } satisfies DirectMessageCursor),
  ).toString("base64url");

const decodeCursor = (cursor: string): DirectMessageCursor => {
  try {
    const value: unknown = JSON.parse(
      Buffer.from(cursor, "base64url").toString("utf8"),
    );
    if (
      typeof value !== "object" ||
      value === null ||
      !("at" in value) ||
      !("id" in value) ||
      typeof value.at !== "string" ||
      typeof value.id !== "string" ||
      Number.isNaN(Date.parse(value.at)) ||
      !/^[a-f\d]{24}$/i.test(value.id)
    ) {
      throw new Error("Invalid cursor");
    }
    return { at: value.at, id: value.id };
  } catch {
    throw new ValidationError("Direct message cursor is invalid");
  }
};

const createDirectMessageService = ({
  conversations,
  memberships,
  organizations,
  organizationPolicy,
  summaries,
  unitOfWork,
}: DirectMessageServiceDependencies) => ({
  async create(
    userId: string,
    organizationId: string,
    input: CreateDirectMessageInput,
  ) {
    if (input.recipientUserId === userId) {
      throw new ValidationError(
        "You cannot create a direct message with yourself",
      );
    }
    const participantPair = buildParticipantPair(userId, input.recipientUserId);
    const { directParticipantKey } = participantPair;

    try {
      const result = await unitOfWork.run(async (context) => {
        const organization =
          await context.organizations.findById(organizationId);
        const actorMembership = await context.memberships.findForUser(
          userId,
          organizationId,
        );
        organizationPolicy.assertMember(organization, actorMembership);
        if (!(await context.organizations.lockForMutation(organizationId))) {
          throw new OrganizationNotFoundError();
        }
        const recipientMembership = await context.memberships.findForUser(
          input.recipientUserId,
          organizationId,
        );
        if (!recipientMembership)
          throw new DirectMessageRecipientNotFoundError();

        const existing = await context.conversations.findDirectByParticipantKey(
          organizationId,
          directParticipantKey,
        );
        if (existing) return { created: false, conversation: existing };

        const conversation = await context.conversations.create({
          organizationId,
          type: ConversationType.DIRECT,
          ...participantPair,
        });
        await context.conversationParticipants.create({
          organizationId,
          conversationId: conversation.id,
          userId,
          addedByUserId: userId,
        });
        await context.conversationParticipants.create({
          organizationId,
          conversationId: conversation.id,
          userId: input.recipientUserId,
          addedByUserId: userId,
        });
        return { created: true, conversation };
      });
      const [directMessage] = await summaries.summarize(userId, [
        result.conversation,
      ]);
      if (!directMessage)
        throw new Error("Direct message summary was not created");
      return { created: result.created, directMessage };
    } catch (error) {
      if (
        error instanceof ConversationPersistenceConflictError ||
        error instanceof ParticipantPersistenceConflictError
      ) {
        const existing = await conversations.findDirectByParticipantKey(
          organizationId,
          directParticipantKey,
        );
        if (existing) {
          const [directMessage] = await summaries.summarize(userId, [existing]);
          if (directMessage) return { created: false, directMessage };
        }
        throw new ConflictError(
          "Direct message creation conflicted with another request",
        );
      }
      throw error;
    }
  },

  async list(
    userId: string,
    organizationId: string,
    query: ListDirectMessagesQuery,
  ) {
    const organization = await organizations.findById(organizationId);
    const membership = await memberships.findForUser(userId, organizationId);
    organizationPolicy.assertMember(organization, membership);
    const cursor = query.before ? decodeCursor(query.before) : undefined;
    const records = await conversations.listDirectForParticipant(
      organizationId,
      userId,
      cursor
        ? { activityAt: new Date(cursor.at), conversationId: cursor.id }
        : undefined,
      query.limit + 1,
    );
    const hasMore = records.length > query.limit;
    const visibleRecords = hasMore ? records.slice(0, query.limit) : records;
    const visible = await summaries.summarize(userId, visibleRecords);
    const lastVisible = visible.at(-1);
    return {
      directMessages: visible,
      nextCursor: hasMore && lastVisible ? encodeCursor(lastVisible) : null,
    };
  },
});

export type DirectMessageService = ReturnType<
  typeof createDirectMessageService
>;
export { buildParticipantKey };
export default createDirectMessageService;
