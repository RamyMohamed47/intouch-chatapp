import assert from "node:assert/strict";
import { describe, test } from "node:test";

import {
  ConversationType,
  ConversationVisibility,
} from "@intouch/shared/conversations";

import type { ConversationActivityAudienceRepository } from "../src/modules/conversation-activity/conversation-activity.repository.js";
import createConversationActivityService from "../src/modules/conversation-activity/conversation-activity.service.js";
import type { ConversationRecord } from "../src/modules/conversations/conversation.types.js";

const actorUserId = "507f1f77bcf86cd799439011";
const recipientUserId = "507f1f77bcf86cd799439012";
const organizationId = "507f1f77bcf86cd799439013";
const conversationId = "507f1f77bcf86cd799439014";
const now = new Date("2026-08-27T12:00:00.000Z");

const conversation = (
  visibility: "PUBLIC" | "PRIVATE",
): ConversationRecord => ({
  id: conversationId,
  organizationId,
  categoryId: "507f1f77bcf86cd799439015",
  name: "general",
  type: ConversationType.CHANNEL,
  visibility,
  position: 0,
  createdAt: now,
  updatedAt: now,
});

const createHarness = (
  overrides: Partial<ConversationActivityAudienceRepository> = {},
) => {
  const audienceCalls: string[] = [];
  const events: Array<{ recipients: readonly string[]; kind: string }> = [];
  const loggedErrors: unknown[] = [];
  const audiences: ConversationActivityAudienceRepository = {
    listOrganizationMemberUserIds: async () => {
      audienceCalls.push("organization");
      return [recipientUserId];
    },
    listParticipantMemberUserIds: async () => {
      audienceCalls.push("participants");
      return [recipientUserId];
    },
    ...overrides,
  };
  const service = createConversationActivityService({
    audiences,
    logger: {
      error(context: object) {
        loggedErrors.push(context);
      },
    },
    realtime: {
      conversationActivity(recipients, event) {
        events.push({ recipients, kind: event.kind });
        assert.match(event.activityId, /^[\da-f-]{36}$/i);
      },
    },
  });
  return { audienceCalls, events, loggedErrors, service };
};

describe("conversationActivityService", () => {
  test("targets current organization members for public channels", async () => {
    const harness = createHarness();
    await harness.service.messageCreated(
      conversation(ConversationVisibility.PUBLIC),
      actorUserId,
    );
    assert.deepEqual(harness.audienceCalls, ["organization"]);
    assert.deepEqual(harness.events, [
      { recipients: [recipientUserId], kind: "MESSAGE_CREATED" },
    ]);
  });

  test("targets current participants for private conversations", async () => {
    const harness = createHarness();
    await harness.service.messageUpdated(
      conversation(ConversationVisibility.PRIVATE),
      actorUserId,
    );
    assert.deepEqual(harness.audienceCalls, ["participants"]);
    assert.deepEqual(harness.events[0]?.kind, "MESSAGE_UPDATED");
  });

  test("logs delivery failures without rejecting persisted work", async () => {
    const harness = createHarness({
      listOrganizationMemberUserIds: async () => {
        throw new Error("temporary audience failure");
      },
    });
    await harness.service.messageDeleted(
      conversation(ConversationVisibility.PUBLIC),
      actorUserId,
    );
    assert.equal(harness.events.length, 0);
    assert.equal(harness.loggedErrors.length, 1);
  });
});
