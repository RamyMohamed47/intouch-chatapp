import assert from "node:assert/strict";
import { describe, test } from "node:test";

import {
  ConversationType,
  ConversationVisibility,
} from "@intouch/shared/conversations";
import { MembershipRole } from "@intouch/shared/memberships";
import { OrganizationVisibility } from "@intouch/shared/organizations";
import { SearchType } from "@intouch/shared/search";
import type { Logger } from "pino";

import type {
  ConversationParticipantRepository,
  ConversationRecord,
  ConversationRepository,
} from "../src/modules/conversations/index.js";
import { ConversationNotFoundError } from "../src/modules/conversations/conversation.errors.js";
import type { MembershipService } from "../src/modules/memberships/index.js";
import createOrganizationPolicy from "../src/modules/organizations/organization.policy.js";
import type { OrganizationRepository } from "../src/modules/organizations/organization.repository.js";
import type { PresenceService } from "../src/modules/presence/index.js";
import {
  SearchPersistenceUnavailableError,
  SearchUnavailableError,
} from "../src/modules/search/search.errors.js";
import createSearchService from "../src/modules/search/search.service.js";
import type { SearchRepository } from "../src/modules/search/search.types.js";
import type { UserRepository } from "../src/modules/user/user.repository.js";

const actorId = "507f1f77bcf86cd799439001";
const memberId = "507f1f77bcf86cd799439002";
const organizationId = "507f1f77bcf86cd799439003";
const publicChannelId = "507f1f77bcf86cd799439004";
const privateChannelId = "507f1f77bcf86cd799439005";
const hiddenChannelId = "507f1f77bcf86cd799439006";
const directId = "507f1f77bcf86cd799439007";
const categoryId = "507f1f77bcf86cd799439008";
const messageId = "507f1f77bcf86cd799439009";
const now = new Date("2026-08-28T12:00:00.000Z");

const channel = (
  id: string,
  visibility: (typeof ConversationVisibility)[keyof typeof ConversationVisibility],
): ConversationRecord => ({
  id,
  organizationId,
  categoryId,
  name: id === publicChannelId ? "general" : "private-room",
  type: ConversationType.CHANNEL,
  visibility,
  position: 0,
  createdAt: now,
  updatedAt: now,
});

const direct: ConversationRecord = {
  id: directId,
  organizationId,
  type: ConversationType.DIRECT,
  directParticipantKey: `${actorId}:${memberId}`,
  createdAt: now,
  updatedAt: now,
};

const createRepository = (
  overrides: Partial<SearchRepository> = {},
): SearchRepository => ({
  provider: "native",
  searchMessages: async () => ({ records: [], nextCursor: null }),
  searchChannels: async () => ({ records: [], nextCursor: null }),
  searchPeople: async () => ({ records: [], nextCursor: null }),
  listDirectConversationPairs: async () => [
    { conversationId: directId, peerUserId: memberId },
  ],
  ...overrides,
});

const createService = (repository: SearchRepository) => {
  const conversations = {
    listByOrganization: async () => [
      channel(publicChannelId, ConversationVisibility.PUBLIC),
      channel(privateChannelId, ConversationVisibility.PRIVATE),
      channel(hiddenChannelId, ConversationVisibility.PRIVATE),
    ],
    findByIds: async (ids: readonly string[]) =>
      ids.includes(directId) ? [direct] : [],
  } as unknown as ConversationRepository;
  const participants = {
    listConversationIdsForUserInOrganization: async () => [
      privateChannelId,
      directId,
    ],
  } as unknown as ConversationParticipantRepository;
  const memberships = {
    findForUser: async () => ({
      id: "507f1f77bcf86cd799439010",
      userId: actorId,
      organizationId,
      role: MembershipRole.MEMBER,
      joinedAt: now,
    }),
    listForOrganization: async () => [
      {
        id: "507f1f77bcf86cd799439010",
        userId: actorId,
        organizationId,
        role: MembershipRole.MEMBER,
        joinedAt: now,
      },
      {
        id: "507f1f77bcf86cd799439011",
        userId: memberId,
        organizationId,
        role: MembershipRole.MEMBER,
        joinedAt: now,
      },
    ],
  } as unknown as MembershipService;
  const organizations = {
    findById: async () => ({
      id: organizationId,
      name: "InTouch",
      slug: "intouch",
      visibility: OrganizationVisibility.PRIVATE,
      createdAt: now,
      updatedAt: now,
    }),
  } as unknown as OrganizationRepository;
  const users = {
    findPublicByIds: async (ids: readonly string[]) =>
      ids.map((id) => ({
        id,
        username: id === actorId ? "ramy" : "alex",
        displayName: id === actorId ? "Ramy" : "Alex",
        email: `${id}@example.test`,
        createdAt: now,
        updatedAt: now,
      })),
  } as unknown as Pick<UserRepository, "findPublicByIds">;
  const presence = {
    getMany: async (ids: readonly string[]) =>
      ids.map((userId) => ({
        userId,
        status: "OFFLINE" as const,
        lastSeenAt: now,
      })),
  } as Pick<PresenceService, "getMany">;
  const logger = {
    info: () => undefined,
    error: () => undefined,
  } as unknown as Logger;

  return createSearchService({
    conversations,
    logger,
    memberships,
    organizationPolicy: createOrganizationPolicy(),
    organizations,
    participants,
    presence,
    repository,
    users,
  });
};

describe("organization search service", () => {
  test("searches only public, participated private, and direct conversations", async () => {
    let allowedIds: readonly string[] = [];
    const service = createService(
      createRepository({
        searchMessages: async (input) => {
          allowedIds = input.allowedIds;
          return {
            records: [
              {
                id: messageId,
                conversationId: directId,
                senderId: memberId,
                content: "The quarterly roadmap is ready",
                createdAt: now,
              },
            ],
            nextCursor: null,
          };
        },
      }),
    );

    const result = await service.search(actorId, organizationId, {
      q: "roadmap",
      type: SearchType.MESSAGES,
      limit: 20,
    });

    assert.deepEqual(
      new Set(allowedIds),
      new Set([publicChannelId, privateChannelId, directId]),
    );
    assert.equal(allowedIds.includes(hiddenChannelId), false);
    assert.equal(result.results[0]?.kind, "MESSAGE");
    assert.equal(result.results[0]?.conversation.type, ConversationType.DIRECT);
    assert.equal(
      result.results[0]?.snippet.some(({ matched }) => matched),
      true,
    );
  });

  test("returns safe people records and existing direct conversations", async () => {
    let allowedIds: readonly string[] = [];
    const service = createService(
      createRepository({
        searchPeople: async (input) => {
          allowedIds = input.allowedIds;
          return {
            records: [{ id: memberId, username: "alex", displayName: "Alex" }],
            nextCursor: "next-page",
          };
        },
      }),
    );

    const result = await service.search(actorId, organizationId, {
      q: "alex",
      type: SearchType.PEOPLE,
      limit: 20,
    });

    assert.deepEqual(allowedIds, [memberId]);
    assert.equal(result.nextCursor, "next-page");
    assert.deepEqual(result.results[0], {
      kind: "PERSON",
      membershipId: "507f1f77bcf86cd799439011",
      role: MembershipRole.MEMBER,
      user: {
        id: memberId,
        username: "alex",
        displayName: "Alex",
        avatarAssetId: null,
        status: "OFFLINE",
        lastSeenAt: now.toISOString(),
      },
      directConversationId: directId,
    });
    assert.equal("email" in (result.results[0]?.user ?? {}), false);
  });

  test("conceals inaccessible conversation filters", async () => {
    const service = createService(createRepository());
    await assert.rejects(
      service.search(actorId, organizationId, {
        q: "secret",
        type: SearchType.MESSAGES,
        conversationId: hiddenChannelId,
        limit: 20,
      }),
      ConversationNotFoundError,
    );
  });

  test("maps provider failures to the public unavailable error", async () => {
    const service = createService(
      createRepository({
        searchChannels: async () => {
          throw new SearchPersistenceUnavailableError();
        },
      }),
    );
    await assert.rejects(
      service.search(actorId, organizationId, {
        q: "general",
        type: SearchType.CHANNELS,
        limit: 20,
      }),
      SearchUnavailableError,
    );
  });
});
