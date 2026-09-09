import assert from "node:assert/strict";
import { describe, test } from "node:test";

import {
  ConversationType,
  ConversationVisibility,
} from "@intouch/shared/conversations";
import { MembershipRole } from "@intouch/shared/memberships";
import type {
  NotificationCategoryPreferences,
  NotificationMuteDto,
} from "@intouch/shared/notifications";

import ValidationError from "../src/errors/ValidationError.js";
import type { ConversationService } from "../src/modules/conversations/conversation.service.js";
import type { MembershipService } from "../src/modules/memberships/index.js";
import { OrganizationNotFoundError } from "../src/modules/organizations/organization.errors.js";
import type { NotificationPreferenceRepository } from "../src/modules/notifications/notification-preference.repository.js";
import { DEFAULT_NOTIFICATION_CATEGORIES } from "../src/modules/notifications/notification-preference.repository.js";
import createNotificationPreferenceService from "../src/modules/notifications/notification-preference.service.js";

const now = new Date("2026-09-09T00:00:00.000Z");
const userId = "507f1f77bcf86cd799439011";
const organizationId = "507f1f77bcf86cd799439012";
const conversationId = "507f1f77bcf86cd799439013";

const createHarness = (member = true) => {
  let categories = { ...DEFAULT_NOTIFICATION_CATEGORIES };
  let mutes: NotificationMuteDto[] = [];
  const preferences: NotificationPreferenceRepository = {
    getCategories: async () => categories,
    updateCategories: async (_targetUserId, next) => {
      categories = next;
      return next;
    },
    listMutes: async () => mutes,
    upsertMute: async (input) => {
      const mute = {
        organizationId: input.organizationId,
        conversationId: input.conversationId ?? null,
        mutedUntil: input.mutedUntil?.toISOString() ?? null,
      };
      mutes = [
        ...mutes.filter(
          (current) =>
            current.organizationId !== mute.organizationId ||
            current.conversationId !== mute.conversationId,
        ),
        mute,
      ];
    },
    deleteMute: async (input) => {
      mutes = mutes.filter((mute) =>
        input.conversationId
          ? mute.conversationId !== input.conversationId
          : mute.organizationId !== input.organizationId ||
            mute.conversationId !== null,
      );
    },
    allowsPush: async () => true,
  };
  const memberships: Pick<MembershipService, "findForUser"> = {
    findForUser: async () =>
      member
        ? {
            id: "507f1f77bcf86cd799439014",
            userId,
            organizationId,
            role: MembershipRole.MEMBER,
            joinedAt: now,
          }
        : null,
  };
  const conversations: Pick<ConversationService, "getAccessible"> = {
    getAccessible: async () => ({
      id: conversationId,
      organizationId,
      categoryId: "507f1f77bcf86cd799439015",
      name: "general",
      type: ConversationType.CHANNEL,
      visibility: ConversationVisibility.PUBLIC,
      position: 0,
      createdAt: now,
      updatedAt: now,
    }),
  };
  return {
    service: createNotificationPreferenceService({
      conversations,
      memberships,
      preferences,
      now: () => now,
    }),
  };
};

describe("notification preference service", () => {
  test("returns all-enabled defaults and updates categories", async () => {
    const { service } = createHarness();
    assert.deepEqual(await service.get(userId), {
      categories: DEFAULT_NOTIFICATION_CATEGORIES,
      mutes: [],
    });
    const categories: NotificationCategoryPreferences = {
      invitations: true,
      directMessages: false,
      mentionsAndReplies: false,
      reactions: true,
    };
    assert.deepEqual(
      (await service.update(userId, categories)).categories,
      categories,
    );
  });

  test("creates timed and permanent organization or conversation mutes", async () => {
    const { service } = createHarness();
    const timed = await service.muteOrganization(
      userId,
      organizationId,
      "2026-09-09T08:00:00.000Z",
    );
    assert.equal(timed.mutes[0]?.mutedUntil, "2026-09-09T08:00:00.000Z");
    const permanent = await service.muteConversation(
      userId,
      conversationId,
      null,
    );
    assert.equal(permanent.mutes[1]?.conversationId, conversationId);
    assert.equal(permanent.mutes[1]?.mutedUntil, null);
  });

  test("rejects expired mutes and conceals inaccessible organizations", async () => {
    const { service } = createHarness();
    await assert.rejects(
      service.muteOrganization(
        userId,
        organizationId,
        "2026-09-08T23:59:59.000Z",
      ),
      ValidationError,
    );
    await assert.rejects(
      createHarness(false).service.muteOrganization(
        userId,
        organizationId,
        null,
      ),
      OrganizationNotFoundError,
    );
  });
});
