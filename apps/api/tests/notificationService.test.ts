import assert from "node:assert/strict";
import { describe, test } from "node:test";

import {
  NotificationChangeKind,
  NotificationStatus,
  NotificationType,
} from "@intouch/shared/notifications";

import NotificationModel from "../src/modules/notifications/notification.model.js";
import type { NotificationRealtime } from "../src/modules/notifications/notification.realtime.js";
import type { NotificationRepository } from "../src/modules/notifications/notification.repository.js";
import createNotificationService from "../src/modules/notifications/notification.service.js";
import type { NotificationRecord } from "../src/modules/notifications/notification.types.js";
import { NotificationNotFoundError } from "../src/modules/notifications/notification.errors.js";

const now = new Date("2026-08-29T00:00:00.000Z");
const record: NotificationRecord = {
  id: "507f1f77bcf86cd799439011",
  recipientUserId: "507f1f77bcf86cd799439012",
  actorUserId: "507f1f77bcf86cd799439013",
  organizationId: "507f1f77bcf86cd799439014",
  type: NotificationType.DIRECT_MESSAGE_RECEIVED,
  conversationId: "507f1f77bcf86cd799439015",
  latestMessageId: "507f1f77bcf86cd799439016",
  messageCount: 3,
  readAt: null,
  lastActivityAt: now,
  expiresAt: new Date("2026-09-28T00:00:00.000Z"),
  createdAt: now,
  updatedAt: now,
};

const repository = (
  overrides: Partial<NotificationRepository> = {},
): NotificationRepository => ({
  create: async () => record,
  upsertDirectMessage: async () => record,
  upsertReaction: async () => record,
  listForUser: async () => [record],
  countUnread: async () => 1,
  markRead: async () => ({ ...record, readAt: now }),
  markAllRead: async () => 1,
  markDirectMessageReadThrough: async () => ({ ...record, readAt: now }),
  deleteReaction: async () => null,
  deleteByInvitationId: async () => [],
  deleteByMessageId: async () => [],
  deleteByConversationId: async () => [],
  deleteByConversationAndRecipient: async () => [],
  deleteByConversationAndActor: async () => [],
  deleteByOrganizationId: async () => [],
  ...overrides,
});

const createHarness = (notifications = repository()) => {
  const events: Parameters<NotificationRealtime["notificationChanged"]>[] = [];
  const service = createNotificationService({
    logger: { error() {} },
    notifications,
    organizations: {
      findByIds: async () => [
        {
          id: record.organizationId,
          name: "Northstar",
          slug: "northstar",
          visibility: "PRIVATE",
          createdAt: now,
          updatedAt: now,
        },
      ],
    },
    realtime: {
      notificationChanged(userId, event) {
        events.push([userId, event]);
      },
    },
    users: {
      findPublicByIds: async () => [
        {
          id: record.actorUserId,
          username: "alex",
          displayName: "Alex Rivera",
          email: "alex@example.com",
          createdAt: now,
          updatedAt: now,
        },
      ],
    },
    now: () => now,
  });
  return { events, service };
};

describe("notification service", () => {
  test("returns personalized cursor pages without exposing email", async () => {
    const { service } = createHarness();
    const page = await service.list(record.recipientUserId, {
      status: NotificationStatus.ALL,
      limit: 20,
    });
    assert.equal(page.unreadCount, 1);
    assert.equal(page.notifications[0]?.actor.displayName, "Alex Rivera");
    assert.equal("email" in (page.notifications[0]?.actor ?? {}), false);
  });

  test("marks owned notifications read and emits authoritative state", async () => {
    const { events, service } = createHarness();
    const notification = await service.markRead(
      record.recipientUserId,
      record.id,
    );
    assert.equal(notification.readAt, now.toISOString());
    assert.equal(events[0]?.[1].kind, NotificationChangeKind.UPSERTED);
  });

  test("conceals unknown or foreign notifications", async () => {
    const { service } = createHarness(
      repository({ markRead: async () => null }),
    );
    await assert.rejects(
      service.markRead(record.recipientUserId, record.id),
      NotificationNotFoundError,
    );
  });

  test("declares recipient, grouping, cleanup, and expiry indexes", () => {
    const indexes = NotificationModel.schema.indexes();
    assert.equal(
      indexes.some(
        ([, options]) =>
          options.name === "unique_active_notification_group" &&
          options.unique === true,
      ),
      true,
    );
    assert.equal(
      indexes.some(
        ([, options]) =>
          options.name === "notification_expiry" &&
          options.expireAfterSeconds === 0,
      ),
      true,
    );
  });
});
