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
import type { OrganizationUnitOfWork } from "../organizations/organization.unit-of-work.js";
import type { UserRepository } from "../user/user.repository.js";
import type { PublicUser } from "../user/user.types.js";
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
  ConversationParticipantView,
  OrganizationMemberView,
} from "./conversation.types.js";

export interface ConversationServiceDependencies {
  categories: CategoryRepository;
  conversations: ConversationRepository;
  memberships: MembershipService;
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
  status: user.status,
  ...(user.avatarUrl ? { avatarUrl: user.avatarUrl } : {}),
});

const createConversationService = ({
  categories,
  conversations,
  memberships,
  organizations,
  participants,
  policy,
  organizationPolicy,
  realtime,
  unitOfWork,
  users,
}: ConversationServiceDependencies) => {
  const getAccess = async (userId: string, conversationId: string) => {
    const conversation = await conversations.findById(conversationId);
    if (!conversation) throw new ConversationNotFoundError();
    const [membership, participant] = await Promise.all([
      memberships.findForUser(userId, conversation.organizationId),
      participants.find(conversationId, userId),
    ]);
    return policy.assertAccessible(conversation, membership, participant);
  };

  return {
    getAccessible: getAccess,

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

      const [organizationCategories, records] = await Promise.all([
        categories.listByOrganization(organizationId),
        conversations.listByOrganization(organizationId, categoryId),
      ]);
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

      return records
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
    },

    getById(userId: string, conversationId: string) {
      return getAccess(userId, conversationId);
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
          policy.assertOwner(conversation, membership, actorParticipant);
          previousVisibility = conversation.visibility;

          const targetCategoryId = input.categoryId ?? conversation.categoryId;
          const targetCategory =
            await context.categories.findById(targetCategoryId);
          if (
            !targetCategory ||
            targetCategory.organizationId !== conversation.organizationId
          ) {
            throw new CategoryNotFoundError();
          }

          let position = conversation.position;
          if (targetCategoryId !== conversation.categoryId) {
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
              conversation.categoryId,
            );
            await context.conversations.shiftPositions(
              conversation.categoryId,
              conversation.position + 1,
              oldCount - 1,
              -1,
            );
          } else if (input.position !== undefined) {
            const count =
              await context.conversations.countByCategory(targetCategoryId);
            position = Math.min(input.position, Math.max(0, count - 1));
            if (position < conversation.position) {
              await context.conversations.shiftPositions(
                targetCategoryId,
                position,
                conversation.position - 1,
                1,
              );
            } else if (position > conversation.position) {
              await context.conversations.shiftPositions(
                targetCategoryId,
                conversation.position + 1,
                position,
                -1,
              );
            }
          }

          if (
            input.visibility !== undefined &&
            input.visibility !== conversation.visibility
          ) {
            await context.conversationParticipants.deleteByConversationId(
              conversationId,
            );
            if (input.visibility === ConversationVisibility.PRIVATE) {
              await context.conversationParticipants.create({
                organizationId: conversation.organizationId,
                conversationId,
                userId,
                addedByUserId: userId,
              });
            }
          }

          const result = await context.conversations.updateById(
            conversationId,
            {
              ...(targetCategoryId !== conversation.categoryId
                ? { categoryId: targetCategoryId }
                : {}),
              ...(input.name !== undefined
                ? { name: input.name, nameKey: normalizeNameKey(input.name) }
                : {}),
              ...(input.visibility !== undefined
                ? { visibility: input.visibility }
                : {}),
              ...(position !== conversation.position ? { position } : {}),
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
        policy.assertOwner(conversation, membership, actorParticipant);
        const count = await context.conversations.countByCategory(
          conversation.categoryId,
        );
        await context.messages.deleteByConversationId(conversationId);
        await context.conversationParticipants.deleteByConversationId(
          conversationId,
        );
        if (!(await context.conversations.deleteById(conversationId))) {
          throw new ConversationNotFoundError();
        }
        await context.conversations.shiftPositions(
          conversation.categoryId,
          conversation.position + 1,
          count - 1,
          -1,
        );
      });
      await realtime.closeConversation(conversationId);
    },

    async listOrganizationMembers(userId: string, organizationId: string) {
      const organization = await organizations.findById(organizationId);
      const membership = await memberships.findForUser(userId, organizationId);
      organizationPolicy.assertOwner(organization, membership);
      const records = await memberships.listForOrganization(organizationId);
      const publicUsers = await users.findPublicByIds(
        records.map(({ userId: memberId }) => memberId),
      );
      const usersById = new Map(publicUsers.map((user) => [user.id, user]));
      return records.flatMap<OrganizationMemberView>((record) => {
        const user = usersById.get(record.userId);
        return user
          ? [
              {
                membershipId: record.id,
                role: record.role,
                joinedAt: record.joinedAt,
                user: toMemberUser(user),
              },
            ]
          : [];
      });
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
