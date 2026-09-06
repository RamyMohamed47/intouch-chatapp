import assert from "node:assert/strict";
import { describe, test } from "node:test";

import { AiScopeKind, AiTask } from "@intouch/shared/ai";
import {
  ChannelKind,
  ConversationType,
  ConversationVisibility,
} from "@intouch/shared/conversations";
import { OrganizationVisibility } from "@intouch/shared/organizations";

import { getLogger } from "../src/config/logger.js";
import createAiService, {
  AI_DISCLOSURE_VERSION,
  type AiServiceDependencies,
} from "../src/modules/ai/ai.service.js";
import type { AiRepository } from "../src/modules/ai/ai.repository.js";
import type {
  AiProviderRequest,
  AiQuotaStore,
} from "../src/modules/ai/ai.types.js";
import { MembershipRole } from "../src/modules/memberships/index.js";
import createOrganizationPolicy from "../src/modules/organizations/organization.policy.js";

const now = new Date("2026-09-06T12:00:00.000Z");
const organizationId = "64c000000000000000000001";
const userId = "64b000000000000000000001";
const publicChannelId = "64d000000000000000000001";
const privateChannelId = "64d000000000000000000002";
const voiceChannelId = "64d000000000000000000003";

const repository: AiRepository = {
  findSettings: () =>
    Promise.resolve({
      organizationId,
      enabled: true,
      disclosureVersion: AI_DISCLOSURE_VERSION,
      enabledByUserId: userId,
      enabledAt: now,
    }),
  setEnabled: () => Promise.reject(new Error("Not used")),
  disable: () => Promise.resolve(),
  findConsent: () =>
    Promise.resolve({
      organizationId,
      userId,
      disclosureVersion: AI_DISCLOSURE_VERSION,
      acceptedAt: now,
    }),
  acceptConsent: () => Promise.reject(new Error("Not used")),
  deleteConsent: () => Promise.resolve(),
  deleteConsentsByOrganization: () => Promise.resolve(),
  deleteByOrganization: () => Promise.resolve(),
};

const quota: AiQuotaStore = {
  admit: () =>
    Promise.resolve({
      allowed: true,
      leaseId: "lease-1",
      status: {
        userRemaining: 24,
        organizationRemaining: 199,
        resetsAt: new Date("2026-09-07T00:00:00.000Z"),
      },
    }),
  getStatus: () =>
    Promise.resolve({
      userRemaining: 25,
      organizationRemaining: 200,
      resetsAt: new Date("2026-09-07T00:00:00.000Z"),
    }),
  release: () => Promise.resolve(),
  close() {},
};

const buildDependencies = (
  providerRequests: AiProviderRequest[],
  searchedAllowedIds: string[][],
): AiServiceDependencies => ({
  accessScope: {
    getForUser: () =>
      Promise.resolve({
        accessibleChannels: [
          {
            id: publicChannelId,
            organizationId,
            categoryId: "64e000000000000000000001",
            kind: ChannelKind.TEXT,
            name: "general",
            type: ConversationType.CHANNEL,
            visibility: ConversationVisibility.PUBLIC,
            position: 0,
            createdAt: now,
            updatedAt: now,
          },
          {
            id: privateChannelId,
            organizationId,
            categoryId: "64e000000000000000000001",
            kind: ChannelKind.TEXT,
            name: "leadership",
            type: ConversationType.CHANNEL,
            visibility: ConversationVisibility.PRIVATE,
            position: 1,
            createdAt: now,
            updatedAt: now,
          },
          {
            id: voiceChannelId,
            organizationId,
            categoryId: "64e000000000000000000001",
            kind: ChannelKind.VOICE,
            name: "lounge",
            type: ConversationType.CHANNEL,
            visibility: ConversationVisibility.PUBLIC,
            position: 2,
            createdAt: now,
            updatedAt: now,
          },
        ],
        directConversations: [],
        memberships: [],
      }),
  },
  dailyOrganizationRequests: 200,
  dailyUserRequests: 25,
  logger: getLogger(),
  memberships: {
    findForUser: () =>
      Promise.resolve({
        id: "64f000000000000000000001",
        organizationId,
        userId,
        role: MembershipRole.OWNER,
        joinedAt: now,
      }),
  } as unknown as AiServiceDependencies["memberships"],
  messages: {} as AiServiceDependencies["messages"],
  model: "test-gemini-model",
  organizationPolicy: createOrganizationPolicy(),
  organizations: {
    findById: () =>
      Promise.resolve({
        id: organizationId,
        name: "InTouch",
        slug: "intouch",
        visibility: OrganizationVisibility.PRIVATE,
        createdAt: now,
        updatedAt: now,
      }),
  } as unknown as AiServiceDependencies["organizations"],
  provider: {
    name: "gemini",
    streamText(request) {
      providerRequests.push(request);
      return Promise.resolve(
        (async function* () {
          yield { type: "delta" as const, text: "Workspace answer [S1]" };
          yield {
            type: "completed" as const,
            finishReason: "STOP",
            usage: { inputTokens: 10, outputTokens: 4 },
          };
        })(),
      );
    },
  },
  quota,
  repository,
  search: {
    provider: "native",
    searchMessages(input) {
      searchedAllowedIds.push([...input.allowedIds]);
      return Promise.resolve({
        records: [
          {
            id: "650000000000000000000001",
            conversationId: publicChannelId,
            senderId: userId,
            content: "The launch is on Monday.",
            createdAt: now,
          },
        ],
        nextCursor: null,
      });
    },
  } as AiServiceDependencies["search"],
  serviceTier: "free",
  unitOfWork: {
    run: (work) => work(repository),
  },
  users: {
    findPublicByIds: () =>
      Promise.resolve([
        {
          id: userId,
          username: "ramy",
          displayName: "Ramy",
          email: "ramy@example.com",
          createdAt: now,
          updatedAt: now,
        },
      ]),
  },
  now: () => now,
});

describe("AI service", () => {
  test("retrieves workspace context from public text channels only", async () => {
    const providerRequests: AiProviderRequest[] = [];
    const searchedAllowedIds: string[][] = [];
    const service = createAiService(
      buildDependencies(providerRequests, searchedAllowedIds),
    );

    const prepared = await service.createResponse(
      userId,
      organizationId,
      {
        task: AiTask.ASK,
        prompt: "When is launch?",
        scope: { kind: AiScopeKind.ORGANIZATION },
      },
      new AbortController().signal,
    );
    const chunks = [];
    for await (const chunk of prepared.stream) chunks.push(chunk);
    await prepared.release();

    assert.deepEqual(searchedAllowedIds, [[publicChannelId]]);
    assert.equal(prepared.sources.length, 1);
    assert.match(providerRequests[0]?.prompt ?? "", /launch is on Monday/);
    assert.deepEqual(
      chunks.map(({ type }) => type),
      ["delta", "completed"],
    );
  });
});
