import assert from "node:assert/strict";
import { beforeEach, describe, test } from "node:test";

import {
  ChatWallpaperId,
  ChatWallpaperSource,
} from "@intouch/shared/chat-wallpapers";
import {
  ConversationType,
  ConversationVisibility,
} from "@intouch/shared/conversations";

import type { ChatWallpaperRepository } from "../src/modules/chat-wallpapers/chat-wallpaper.repository.js";
import type { ChatWallpaperPreferenceRecord } from "../src/modules/chat-wallpapers/chat-wallpaper.types.js";
import { ConversationNotFoundError } from "../src/modules/conversations/conversation.errors.js";
import createConversationPolicy from "../src/modules/conversations/conversation.policy.js";
import createChatWallpaperService from "../src/modules/chat-wallpapers/chat-wallpaper.service.js";
import { MembershipRole } from "../src/modules/memberships/index.js";
import type { MembershipService } from "../src/modules/memberships/index.js";
import type { OrganizationRepository } from "../src/modules/organizations/organization.repository.js";
import {
  createTestUnitOfWork,
  emptyCommunicationContext,
} from "./unitOfWorkContext.js";

const userId = "507f1f77bcf86cd799439011";
const organizationId = "507f1f77bcf86cd799439012";
const conversationId = "507f1f77bcf86cd799439013";
const now = new Date("2026-08-29T12:00:00.000Z");
const conversation = {
  id: conversationId,
  organizationId,
  categoryId: "507f1f77bcf86cd799439014",
  name: "general",
  type: ConversationType.CHANNEL,
  visibility: ConversationVisibility.PUBLIC,
  position: 0,
  createdAt: now,
  updatedAt: now,
};
let member = true;
let defaultPreference: ChatWallpaperPreferenceRecord | null;
let conversationPreference: ChatWallpaperPreferenceRecord | null;

const record = (
  input: Pick<
    ChatWallpaperPreferenceRecord,
    "userId" | "conversationId" | "wallpaperId" | "dimming"
  >,
): ChatWallpaperPreferenceRecord => ({
  id: "507f1f77bcf86cd799439099",
  ...input,
  createdAt: now,
  updatedAt: now,
});

const preferences: ChatWallpaperRepository = {
  findDefault: async () => defaultPreference,
  findForConversation: async () => conversationPreference,
  upsert: async (input) => {
    const preference = record(input);
    if (input.conversationId) conversationPreference = preference;
    else defaultPreference = preference;
    return preference;
  },
  deleteForConversation: async () => {
    const existed = conversationPreference !== null;
    conversationPreference = null;
    return existed;
  },
  deleteByConversationId: async () => 0,
  deleteByConversationIds: async () => 0,
};

const memberships: MembershipService = {
  createOwner: async () => {
    throw new Error("Unused");
  },
  createMember: async () => {
    throw new Error("Unused");
  },
  findForUser: async () =>
    member
      ? {
          id: "507f1f77bcf86cd799439098",
          userId,
          organizationId,
          role: MembershipRole.MEMBER,
          joinedAt: now,
        }
      : null,
  listForUser: async () => [],
  listForOrganization: async () => [],
  deleteForOrganization: async () => 0,
};

const conversations = {
  ...emptyCommunicationContext.conversations,
  findById: async (id: string) => (id === conversationId ? conversation : null),
};
const participants = {
  ...emptyCommunicationContext.conversationParticipants,
  find: async () => null,
};
const organizations: OrganizationRepository = {
  create: async () => {
    throw new Error("Unused");
  },
  findById: async () => null,
  findByIds: async () => [],
  lockForMutation: async () => true,
  updateById: async () => null,
  replaceLogoAsset: async () => null,
  deleteById: async () => false,
};

const service = createChatWallpaperService({
  conversations,
  memberships,
  participants,
  policy: createConversationPolicy(),
  preferences,
  unitOfWork: createTestUnitOfWork({
    chatWallpapers: preferences,
    conversations,
    conversationParticipants: participants,
    memberships,
    organizations,
  }),
});

describe("chat wallpaper service", () => {
  beforeEach(() => {
    member = true;
    defaultPreference = null;
    conversationPreference = null;
  });

  test("resolves the built-in default without creating a record", async () => {
    assert.deepEqual(await service.getDefault(userId), {
      wallpaperId: ChatWallpaperId.INTOUCH_DOODLE,
      dimming: 35,
      source: ChatWallpaperSource.DEFAULT,
    });
    assert.equal(defaultPreference, null);
  });

  test("persists defaults and private conversation overrides", async () => {
    await service.setDefault(userId, {
      wallpaperId: ChatWallpaperId.ABSTRACT_OCEAN,
      dimming: 25,
    });
    assert.equal(
      (await service.getForConversation(userId, conversationId)).source,
      ChatWallpaperSource.DEFAULT,
    );

    const overridden = await service.setForConversation(
      userId,
      conversationId,
      { wallpaperId: ChatWallpaperId.SCENERY_FOREST, dimming: 45 },
    );
    assert.deepEqual(overridden, {
      wallpaperId: ChatWallpaperId.SCENERY_FOREST,
      dimming: 45,
      source: ChatWallpaperSource.CONVERSATION,
    });

    await service.resetConversation(userId, conversationId);
    assert.equal(
      (await service.getForConversation(userId, conversationId)).wallpaperId,
      ChatWallpaperId.ABSTRACT_OCEAN,
    );
  });

  test("conceals wallpaper preferences from nonmembers", async () => {
    member = false;
    await assert.rejects(
      service.getForConversation(userId, conversationId),
      ConversationNotFoundError,
    );
    await assert.rejects(
      service.setForConversation(userId, conversationId, {
        wallpaperId: ChatWallpaperId.DOODLE_ORBIT,
        dimming: 20,
      }),
      ConversationNotFoundError,
    );
  });
});
