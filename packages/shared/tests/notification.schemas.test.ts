import assert from "node:assert/strict";
import { describe, test } from "node:test";

import {
  NotificationChangeKind,
  NotificationStatus,
  NotificationType,
  notificationChangedEventSchema,
  notificationDtoSchema,
  notificationListQuerySchema,
  notificationMuteRequestSchema,
  notificationPreferencesResponseSchema,
  updateNotificationPreferencesSchema,
} from "../notifications/index.js";

const id = "507f1f77bcf86cd799439011";
const notification = {
  id,
  type: NotificationType.DIRECT_MESSAGE_RECEIVED,
  actor: {
    id: "507f1f77bcf86cd799439012",
    username: "alex",
    displayName: "Alex Rivera",
    avatarAssetId: null,
  },
  organization: {
    id: "507f1f77bcf86cd799439013",
    name: "Northstar",
    logoAssetId: null,
  },
  conversationId: "507f1f77bcf86cd799439014",
  latestMessageId: "507f1f77bcf86cd799439015",
  messageCount: 2,
  readAt: null,
  createdAt: "2026-08-29T00:00:00.000Z",
  lastActivityAt: "2026-08-29T00:01:00.000Z",
} as const;

describe("notification contracts", () => {
  test("coerces pagination and defaults to all notifications", () => {
    assert.deepEqual(notificationListQuerySchema.parse({ limit: "10" }), {
      status: NotificationStatus.ALL,
      limit: 10,
    });
    assert.equal(
      notificationListQuerySchema.safeParse({ extra: true }).success,
      false,
    );
  });

  test("parses strict discriminated notification records", () => {
    const parsed = notificationDtoSchema.parse(notification);
    assert.equal(parsed.type, NotificationType.DIRECT_MESSAGE_RECEIVED);
    if (parsed.type !== NotificationType.DIRECT_MESSAGE_RECEIVED) {
      throw new Error("Expected a direct-message notification");
    }
    assert.equal(parsed.messageCount, 2);
    assert.equal(
      notificationDtoSchema.safeParse({ ...notification, email: "hidden" })
        .success,
      false,
    );
  });

  test("parses strict realtime notification changes", () => {
    const parsed = notificationChangedEventSchema.parse({
      kind: NotificationChangeKind.UPSERTED,
      notification,
    });
    assert.equal(parsed.kind, NotificationChangeKind.UPSERTED);
    if (parsed.kind !== NotificationChangeKind.UPSERTED) {
      throw new Error("Expected an upsert notification event");
    }
    assert.deepEqual(parsed.notification, notification);
    assert.equal(
      notificationChangedEventSchema.safeParse({
        kind: NotificationChangeKind.READ_ALL,
        notificationId: id,
      }).success,
      false,
    );
  });

  test("validates notification categories and timed or permanent mutes", () => {
    const categories = {
      invitations: true,
      directMessages: false,
      mentionsAndReplies: true,
      reactions: false,
    };
    assert.deepEqual(
      updateNotificationPreferencesSchema.parse({ categories }),
      {
        categories,
      },
    );
    assert.deepEqual(
      notificationMuteRequestSchema.parse({ mutedUntil: null }),
      {
        mutedUntil: null,
      },
    );
    assert.equal(
      notificationMuteRequestSchema.safeParse({ mutedUntil: null, extra: true })
        .success,
      false,
    );
    assert.equal(
      notificationPreferencesResponseSchema.safeParse({
        preferences: { categories, mutes: [] },
      }).success,
      true,
    );
  });

  test("parses dedicated mention and reply notifications", () => {
    const base = {
      id: notification.id,
      actor: notification.actor,
      organization: notification.organization,
      conversationId: "507f1f77bcf86cd799439014",
      messageId: "507f1f77bcf86cd799439015",
      readAt: notification.readAt,
      createdAt: notification.createdAt,
      lastActivityAt: notification.lastActivityAt,
    };
    assert.equal(
      notificationDtoSchema.safeParse({
        ...base,
        type: NotificationType.CHANNEL_MENTION_RECEIVED,
      }).success,
      true,
    );
    assert.equal(
      notificationDtoSchema.safeParse({
        ...base,
        type: NotificationType.MESSAGE_REPLY_RECEIVED,
      }).success,
      true,
    );
  });
});
