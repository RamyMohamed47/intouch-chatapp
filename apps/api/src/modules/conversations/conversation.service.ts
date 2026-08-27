import {
  ConversationType,
  ConversationVisibility,
  type CreateConversationInput,
  type UpdateConversationInput,
} from "@intouch/shared/conversations";

import type { CategoryRepository } from "../categories/category.repository.js";
import { CategoryNotFoundError } from "../categories/category.errors.js";
import {
  MembershipRole,
  type MembershipService,
} from "../memberships/index.js";
import type { OrganizationRepository } from "../organizations/organization.repository.js";
import type { OrganizationPolicy } from "../organizations/organization.policy.js";
import type {
  OrganizationUnitOfWork,
  OrganizationWorkContext,
} from "../organizations/organization.unit-of-work.js";
import type { UserRepository } from "../user/user.repository.js";
import type { PublicUser } from "../user/user.types.js";
import type { ConversationSummaryRepository } from "../message/conversation-summary.repository.js";
import normalizeNameKey from "../../utils/normalizeNameKey.js";
import {
  ConversationConflictError,
  ConversationNotFoundError,
  ParticipantConflictError,
  ParticipantNotFoundError,
} from "./conversation.errors.js";
import {
  ParticipantPersistenceConflictError,
  type ConversationParticipantRepository,
} from "./conversation-participant.repository.js";
import {
  ConversationPersistenceConflictError,
  type ConversationRepository,
} from "./conversation.repository.js";
import type { ConversationPolicy } from "./conversation.policy.js";
import type { ConversationRealtime } from "./conversation.realtime.js";
import type {
  ConversationRecord,
  ConversationSummary,
  ConversationParticipantView,
} from "./conversation.types.js";
import { isChannelConversation } from "./conversation.types.js";

export interface ConversationServiceDependencies {
  categories: CategoryRepository;
  conversations: ConversationRepository;
  memberships: MembershipService;
  conversationSummaries: ConversationSummaryRepository;
  organizations: OrganizationRepository;
  participants: ConversationParticipantRepository;
  policy: ConversationPolicy;
  organizationPolicy: OrganizationPolicy;
  realtime: ConversationRealtime;
  unitOfWork: OrganizationUnitOfWork;
  users: UserRepository;
}

const mapPersistenceConflict = (error: unknown): never => {
  if (error instanceof ConversationPersistenceConflictError) {
    throw new ConversationConflictError("Conversation name already exists");
  }
  if (error instanceof ParticipantPersistenceConflictError) {
    throw new ParticipantConflictError();
  }
  throw error;
};

const toMemberUser = (user: PublicUser) => ({
  id: user.id,
  username: user.username,
  displayName: user.displayName,
  ...(user.avatarUrl ? { avatarUrl: user.avatarUrl } : {}),
});

const createConversationService = ({
  categories,
  conversations,
  memberships,
  conversationSummaries,
  organizations,
  participants,
  policy,
  organizationPolicy,
  realtime,
  unitOfWork,
  users,
}: ConversationServiceDependencies) => {
  const getAccessFrom = async (
    userId: string,
    conversationId: string,
    repositories: Pick<
      OrganizationWorkContext,
      "conversations" | "conversationParticipants" | "memberships"
    >,
  ) => {
    const conversation =
      await repositories.conversations.findById(conversationId);
    if (!conversation) throw new ConversationNotFoundError();
    const [membership, participant] = await Promise.all([
      repositories.memberships.findForUser(userId, conversation.organizationId),
      repositories.conversationParticipants.find(conversationId, userId),
    ]);
    return policy.assertAccessible(conversation, membership, participant);
  };

  const getAccess = (userId: string, conversationId: string) =>
    getAccessFrom(userId, conversationId, {
      conversations,
      conversationParticipants: participants,
      memberships,
    });

  const summarize = async (
    userId: string,
    records: readonly ConversationRecord[],
  ): Promise<ConversationSummary[]> => {
    const directIds = records
      .filter(({ type }) => type === ConversationType.DIRECT)
      .map(({ id }) => id);
    const directParticipants =
      await participants.listByConversationIds(directIds);
    const peerIdByConversation = new Map<string, string>();
    for (const participant of directParticipants) {
      if (participant.userId !== userId) {
        peerIdByConversation.set(
          participant.conversationId,
          participant.userId,
        );
      }
    }
    const [states, peers] = await Promise.all([
      conversationSummaries.getStates(
        records.map(({ id }) => id),
        userId,
        [...peerIdByConversation].map(([conversationId, peerUserId]) => ({
          conversationId,
          userId: peerUserId,
        })),
      ),
      users.findPublicByIds([...new Set(peerIdByConversation.values())]),
    ]);
    const statesByConversation = new Map(
      states.map((state) => [state.conversationId, state]),
    );
    const peersById = new Map(peers.map((peer) => [peer.id, peer]));

    return records.map((conversation) => {
      const state = statesByConversation.get(conversation.id);
      const receipt = state?.readReceipt;
      const summary: ConversationSummary = {
        id: conversation.id,
        organizationId: conversation.organizationId,
        type: conversation.type,
        createdAt: conversation.createdAt,
        updatedAt: conversation.updatedAt,
        lastMessage: state?.lastMessage ?? null,
        unreadCount: state?.unreadCount ?? 0,
        readReceipt: receipt
          ? {
              id: receipt.id,
              conversationId: receipt.conversationId,
              userId: receipt.userId,
              lastReadMessageId: receipt.lastReadMessageId,
              lastReadAt: receipt.lastReadAt,
            }
          : null,
      };
      if (conversation.categoryId !== undefined) {
        summary.categoryId = conversation.categoryId;
      }
      if (conversation.name !== undefined) summary.name = conversation.name;
      if (conversation.visibility !== undefined) {
        summary.visibility = conversation.visibility;
      }
      if (conversation.position !== undefined) {
        summary.position = conversation.position;
      }
      const peerId = peerIdByConversation.get(conversation.id);
      const peer = peerId ? peersById.get(peerId) : undefined;
      if (conversation.type === ConversationType.DIRECT) {
        summary.peerReadReceipt = state?.peerReadReceipt
          ? {
              id: state.peerReadReceipt.id,
              conversationId: state.peerReadReceipt.conversationId,
              userId: state.peerReadReceipt.userId,
              lastReadMessageId: state.peerReadReceipt.lastReadMessageId,
              lastReadAt: state.peerReadReceipt.lastReadAt,
            }
          : null;
        if (peer) summary.peer = toMemberUser(peer);
      }
      return summary;
    });
  };

  return {
    getAccessible: getAccess,

    getAccessibleInContext: getAccessFrom,

    summarize,

    async create(
      userId: string,
      organizationId: string,
      input: CreateConversationInput,
    ) {
      try {
        return await unitOfWork.run(async (context) => {
          const organization =
            await context.organizations.findById(organizationId);
          const membership = await context.memberships.findForUser(
            userId,
            organizationId,
          );
          organizationPolicy.assertOwner(organization, membership);
          if (!(await context.organizations.lockForMutation(organizationId))) {
            throw new ConversationNotFoundError();
          }
          const category = await context.categories.findById(input.categoryId);
          if (!category || category.organizationId !== organizationId) {
            throw new CategoryNotFoundError();
          }
          const position = await context.conversations.countByCategory(
            input.categoryId,
          );
          const conversation = await context.conversations.create({
            organizationId,
            categoryId: input.categoryId,
            name: input.name,
            nameKey: normalizeNameKey(input.name),
            type: ConversationType.CHANNEL,
            visibility: input.visibility,
            position,
          });

          if (input.visibility === ConversationVisibility.PRIVATE) {
            await context.conversationParticipants.create({
              organizationId,
              conversationId: conversation.id,
              userId,
              addedByUserId: userId,
            });
          }
          return conversation;
        });
      } catch (error) {
        return mapPersistenceConflict(error);
      }
    },

    async list(userId: string, organizationId: string, categoryId?: string) {
      const organization = await organizations.findById(organizationId);
      const membership = await memberships.findForUser(userId, organizationId);
      organizationPolicy.assertMember(organization, membership);

      if (categoryId) {
        const category = await categories.findById(categoryId);
        if (!category || category.organizationId !== organizationId) {
          throw new CategoryNotFoundError();
        }
      }

      const [organizationCategories, conversationRecords] = await Promise.all([
        categories.listByOrganization(organizationId),
        conversations.listByOrganization(organizationId, categoryId),
      ]);
      const records = conversationRecords.filter(isChannelConversation);
      const privateIds = records
        .filter(
          ({ visibility }) => visibility === ConversationVisibility.PRIVATE,
        )
        .map(({ id }) => id);
      const accessiblePrivateIds = new Set(
        await participants.listConversationIdsForUser(userId, privateIds),
      );
      const categoryPosition = new Map(
        organizationCategories.map((category) => [
          category.id,
          category.position,
        ]),
      );

      const accessible = records
        .filter(
          (conversation) =>
            conversation.visibility === ConversationVisibility.PUBLIC ||
            accessiblePrivateIds.has(conversation.id),
        )
        .sort(
          (left, right) =>
            (categoryPosition.get(left.categoryId) ?? 0) -
              (categoryPosition.get(right.categoryId) ?? 0) ||
            left.position - right.position,
        );
      return summarize(userId, accessible);
    },

    async getById(userId: string, conversationId: string) {
      const conversation = await getAccess(userId, conversationId);
      const [summary] = await summarize(userId, [conversation]);
      if (!summary) throw new ConversationNotFoundError();
      return summary;
    },

    async update(
      userId: string,
      conversationId: string,
      input: UpdateConversationInput,
    ) {
      let previousVisibility: string | undefined;
      try {
        const updated = await unitOfWork.run(async (context) => {
          const conversation =
            await context.conversations.findById(conversationId);
          if (!conversation) throw new ConversationNotFoundError();
          const membership = await context.memberships.findForUser(
            userId,
            conversation.organizationId,
          );
          const actorParticipant = await context.conversationParticipants.find(
            conversationId,
            userId,
          );
          const channel = policy.assertOwner(
            conversation,
            membership,
            actorParticipant,
          );
          if (
            !(await context.organizations.lockForMutation(
              channel.organizationId,
            ))
          ) {
            throw new ConversationNotFoundError();
          }
          previousVisibility = channel.visibility;

          const targetCategoryId = input.categoryId ?? channel.categoryId;
          const targetCategory =
            await context.categories.findById(targetCategoryId);
          if (
            !targetCategory ||
            targetCategory.organizationId !== channel.organizationId
          ) {
            throw new CategoryNotFoundError();
          }

          let position = channel.position;
          if (targetCategoryId !== channel.categoryId) {
            const targetCount =
              await context.conversations.countByCategory(targetCategoryId);
            position =
              input.position === undefined
                ? targetCount
                : Math.min(input.position, targetCount);
            await context.conversations.shiftPositions(
              targetCategoryId,
              position,
              targetCount - 1,
              1,
            );
            const oldCount = await context.conversations.countByCategory(
              channel.categoryId,
            );
            await context.conversations.shiftPositions(
              channel.categoryId,
              channel.position + 1,
              oldCount - 1,
              -1,
            );
          } else if (input.position !== undefined) {
            const count =
              await context.conversations.countByCategory(targetCategoryId);
            position = Math.min(input.position, Math.max(0, count - 1));
            if (position < channel.position) {
              await context.conversations.shiftPositions(
                targetCategoryId,
                position,
                channel.position - 1,
                1,
              );
            } else if (position > channel.position) {
              await context.conversations.shiftPositions(
                targetCategoryId,
                channel.position + 1,
                position,
                -1,
              );
            }
          }

          if (
            input.visibility !== undefined &&
            input.visibility !== channel.visibility
          ) {
            await context.conversationParticipants.deleteByConversationId(
              conversationId,
            );
            if (input.visibility === ConversationVisibility.PRIVATE) {
              await context.conversationParticipants.create({
                organizationId: channel.organizationId,
                conversationId,
                userId,
                addedByUserId: userId,
              });
            }
          }

          const result = await context.conversations.updateById(
            conversationId,
            {
              ...(targetCategoryId !== channel.categoryId
                ? { categoryId: targetCategoryId }
                : {}),
              ...(input.name !== undefined
                ? { name: input.name, nameKey: normalizeNameKey(input.name) }
                : {}),
              ...(input.visibility !== undefined
                ? { visibility: input.visibility }
                : {}),
              ...(position !== channel.position ? { position } : {}),
            },
          );
          if (!result) throw new ConversationNotFoundError();
          return result;
        });

        if (
          previousVisibility === ConversationVisibility.PUBLIC &&
          updated.visibility === ConversationVisibility.PRIVATE
        ) {
          await realtime.retainOnlyUser(conversationId, userId);
        }
        return updated;
      } catch (error) {
        return mapPersistenceConflict(error);
      }
    },

    async delete(userId: string, conversationId: string) {
      await unitOfWork.run(async (context) => {
        const conversation =
          await context.conversations.findById(conversationId);
        if (!conversation) throw new ConversationNotFoundError();
        const membership = await context.memberships.findForUser(
          userId,
          conversation.organizationId,
        );
        const actorParticipant = await context.conversationParticipants.find(
          conversationId,
          userId,
        );
        const channel = policy.assertOwner(
          conversation,
          membership,
          actorParticipant,
        );
        if (
          !(await context.organizations.lockForMutation(channel.organizationId))
        ) {
          throw new ConversationNotFoundError();
        }
        const count = await context.conversations.countByCategory(
          channel.categoryId,
        );
        await context.messages.deleteByConversationId(conversationId);
        await context.conversationReadStates.deleteByConversationId(
          conversationId,
        );
        await context.conversationParticipants.deleteByConversationId(
          conversationId,
        );
        if (!(await context.conversations.deleteById(conversationId))) {
          throw new ConversationNotFoundError();
        }
        await context.conversations.shiftPositions(
          channel.categoryId,
          channel.position + 1,
          count - 1,
          -1,
        );
      });
      await realtime.closeConversation(conversationId);
    },

    async listParticipants(userId: string, conversationId: string) {
      const conversation = await conversations.findById(conversationId);
      if (!conversation) throw new ConversationNotFoundError();
      const membership = await memberships.findForUser(
        userId,
        conversation.organizationId,
      );
      const actorParticipant = await participants.find(conversationId, userId);
      policy.assertPrivateOwner(conversation, membership, actorParticipant);
      const records = await participants.listByConversation(conversationId);
      const publicUsers = await users.findPublicByIds(
        records.map(({ userId: participantId }) => participantId),
      );
      const usersById = new Map(publicUsers.map((user) => [user.id, user]));
      return records.flatMap<ConversationParticipantView>((record) => {
        const user = usersById.get(record.userId);
        return user ? [{ ...record, user: toMemberUser(user) }] : [];
      });
    },

    async addParticipant(
      userId: string,
      conversationId: string,
      participantUserId: string,
    ) {
      try {
        return await unitOfWork.run(async (context) => {
          const conversation =
            await context.conversations.findById(conversationId);
          if (!conversation) throw new ConversationNotFoundError();
          const ownerMembership = await context.memberships.findForUser(
            userId,
            conversation.organizationId,
          );
          const actorParticipant = await context.conversationParticipants.find(
            conversationId,
            userId,
          );
          policy.assertPrivateOwner(
            conversation,
            ownerMembership,
            actorParticipant,
          );
          if (
            !(await context.organizations.lockForMutation(
              conversation.organizationId,
            ))
          ) {
            throw new ConversationNotFoundError();
          }
          const targetMembership = await context.memberships.findForUser(
            participantUserId,
            conversation.organizationId,
          );
          if (!targetMembership) throw new ParticipantNotFoundError();
          return context.conversationParticipants.create({
            organizationId: conversation.organizationId,
            conversationId,
            userId: participantUserId,
            addedByUserId: userId,
          });
        });
      } catch (error) {
        return mapPersistenceConflict(error);
      }
    },

    async removeParticipant(
      userId: string,
      conversationId: string,
      participantUserId: string,
    ) {
      await unitOfWork.run(async (context) => {
        const conversation =
          await context.conversations.findById(conversationId);
        if (!conversation) throw new ConversationNotFoundError();
        const ownerMembership = await context.memberships.findForUser(
          userId,
          conversation.organizationId,
        );
        const actorParticipant = await context.conversationParticipants.find(
          conversationId,
          userId,
        );
        policy.assertPrivateOwner(
          conversation,
          ownerMembership,
          actorParticipant,
        );
        if (
          !(await context.organizations.lockForMutation(
            conversation.organizationId,
          ))
        ) {
          throw new ConversationNotFoundError();
        }
        if (
          participantUserId === userId ||
          ownerMembership?.role !== MembershipRole.OWNER
        ) {
          throw new ParticipantConflictError(
            "The organization owner cannot be removed",
          );
        }
        if (
          !(await context.conversationParticipants.delete(
            conversationId,
            participantUserId,
          ))
        ) {
          throw new ParticipantNotFoundError();
        }
      });
      await realtime.evictUser(conversationId, participantUserId);
    },
  };
};

export type ConversationService = ReturnType<typeof createConversationService>;
export default createConversationService;
