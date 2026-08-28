import assert from "node:assert/strict";
import http from "node:http";
import { after, before, describe, test } from "node:test";

import {
  NotificationStatus,
  NotificationType,
  type NotificationDto,
} from "@intouch/shared/notifications";
import type { RequestHandler } from "express";

import createApp from "../src/app.js";
import UnauthorizedError from "../src/errors/UnauthorizedError.js";
import type { AuthLocals } from "../src/modules/auth/auth.types.js";
import createNotificationController from "../src/modules/notifications/notification.controller.js";
import createNotificationRouter from "../src/modules/notifications/notification.routes.js";
import type { NotificationService } from "../src/modules/notifications/notification.service.js";

const userId = "507f1f77bcf86cd799439011";
const notificationId = "507f1f77bcf86cd799439012";
const notification: NotificationDto = {
  id: notificationId,
  actor: {
    id: "507f1f77bcf86cd799439013",
    username: "alex",
    displayName: "Alex Rivera",
  },
  organization: {
    id: "507f1f77bcf86cd799439014",
    name: "Northstar",
  },
  type: NotificationType.DIRECT_MESSAGE_RECEIVED,
  conversationId: "507f1f77bcf86cd799439015",
  latestMessageId: "507f1f77bcf86cd799439016",
  messageCount: 2,
  readAt: null,
  createdAt: "2026-08-29T00:00:00.000Z",
  lastActivityAt: "2026-08-29T00:01:00.000Z",
};

let receivedLimit: number | undefined;
let receivedStatus: string | undefined;
let receivedNotificationId: string | undefined;
let markAllCalls = 0;

const service: NotificationService = {
  hydrate: async () => [],
  publishUpsert: async () => undefined,
  publishDeleted: () => undefined,
  list: async (_userId, query) => {
    receivedLimit = query.limit;
    receivedStatus = query.status;
    return { notifications: [notification], nextCursor: null, unreadCount: 1 };
  },
  markRead: async (_userId, targetNotificationId) => {
    receivedNotificationId = targetNotificationId;
    return { ...notification, readAt: "2026-08-29T00:02:00.000Z" };
  },
  markAllRead: async () => {
    markAllCalls += 1;
  },
};

const requireAccessToken: RequestHandler = (req, res, next) => {
  if (req.get("authorization") !== "Bearer valid-token") {
    next(new UnauthorizedError());
    return;
  }
  (res.locals as AuthLocals).userId = userId;
  next();
};

const allowAuthenticatedAction: RequestHandler = (_req, _res, next) => next();
const app = createApp({
  notificationRouter: createNotificationRouter(
    createNotificationController(service),
    requireAccessToken,
    allowAuthenticatedAction,
  ),
});
const server = http.createServer(app);
let baseUrl: string;

before(async () => {
  await new Promise<void>((resolve) => server.listen(0, resolve));
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("No test port");
  baseUrl = `http://127.0.0.1:${address.port}`;
});

after(async () => {
  await new Promise<void>((resolve, reject) =>
    server.close((error) => (error ? reject(error) : resolve())),
  );
});

describe("notification routes", () => {
  test("requires authentication", async () => {
    const response = await fetch(`${baseUrl}/api/v1/notifications`);
    assert.equal(response.status, 401);
  });

  test("coerces list queries and returns the notification envelope", async () => {
    const response = await fetch(
      `${baseUrl}/api/v1/notifications?status=UNREAD&limit=12`,
      { headers: { authorization: "Bearer valid-token" } },
    );
    assert.equal(response.status, 200);
    assert.equal(receivedStatus, NotificationStatus.UNREAD);
    assert.equal(receivedLimit, 12);
    const body = (await response.json()) as {
      notifications: NotificationDto[];
      unreadCount: number;
    };
    assert.equal(body.notifications[0]?.id, notificationId);
    assert.equal(body.unreadCount, 1);
  });

  test("marks one notification and all notifications read", async () => {
    const oneResponse = await fetch(
      `${baseUrl}/api/v1/notifications/${notificationId}/read`,
      {
        method: "PUT",
        headers: { authorization: "Bearer valid-token" },
      },
    );
    assert.equal(oneResponse.status, 200);
    assert.equal(receivedNotificationId, notificationId);

    const allResponse = await fetch(
      `${baseUrl}/api/v1/notifications/read-all`,
      {
        method: "PUT",
        headers: { authorization: "Bearer valid-token" },
      },
    );
    assert.equal(allResponse.status, 204);
    assert.equal(markAllCalls, 1);
  });

  test("rejects invalid notification IDs", async () => {
    const response = await fetch(
      `${baseUrl}/api/v1/notifications/not-an-id/read`,
      {
        method: "PUT",
        headers: { authorization: "Bearer valid-token" },
      },
    );
    assert.equal(response.status, 400);
  });
});
