import assert from "node:assert/strict";
import http from "node:http";
import { after, before, describe, test } from "node:test";

import type { NotificationPreferencesDto } from "@intouch/shared/notifications";
import type { RequestHandler } from "express";

import createApp from "../src/app.js";
import UnauthorizedError from "../src/errors/UnauthorizedError.js";
import type { AuthLocals } from "../src/modules/auth/auth.types.js";
import createNotificationPreferenceController from "../src/modules/notifications/notification-preference.controller.js";
import createNotificationPreferenceRouter from "../src/modules/notifications/notification-preference.routes.js";
import type { NotificationPreferenceService } from "../src/modules/notifications/notification-preference.service.js";

const userId = "507f1f77bcf86cd799439011";
const organizationId = "507f1f77bcf86cd799439012";
const conversationId = "507f1f77bcf86cd799439013";
const base: NotificationPreferencesDto = {
  categories: {
    invitations: true,
    directMessages: true,
    mentionsAndReplies: true,
    reactions: true,
  },
  mutes: [],
};
let lastOperation = "";

const service: NotificationPreferenceService = {
  get: async () => base,
  update: async (_targetUserId, categories) => {
    lastOperation = "update";
    return { ...base, categories };
  },
  muteOrganization: async (_targetUserId, targetOrganizationId, mutedUntil) => {
    lastOperation = "mute-organization";
    return {
      ...base,
      mutes: [
        {
          organizationId: targetOrganizationId,
          conversationId: null,
          mutedUntil,
        },
      ],
    };
  },
  unmuteOrganization: async () => {
    lastOperation = "unmute-organization";
    return base;
  },
  muteConversation: async (_targetUserId, targetConversationId, mutedUntil) => {
    lastOperation = "mute-conversation";
    return {
      ...base,
      mutes: [
        {
          organizationId,
          conversationId: targetConversationId,
          mutedUntil,
        },
      ],
    };
  },
  unmuteConversation: async () => {
    lastOperation = "unmute-conversation";
    return base;
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
const allowMutation: RequestHandler = (_req, _res, next) => next();
const app = createApp({
  notificationPreferenceRouter: createNotificationPreferenceRouter(
    createNotificationPreferenceController(service),
    requireAccessToken,
    allowMutation,
  ),
});
const server = http.createServer(app);
let baseUrl = "";

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

const authorizedJson = (method: "PUT" | "DELETE", body?: object) => ({
  method,
  headers: {
    authorization: "Bearer valid-token",
    ...(body ? { "content-type": "application/json" } : {}),
  },
  ...(body ? { body: JSON.stringify(body) } : {}),
});

describe("notification preference routes", () => {
  test("requires authentication and returns all current settings", async () => {
    assert.equal(
      (await fetch(`${baseUrl}/api/v1/users/me/notification-preferences`))
        .status,
      401,
    );
    const response = await fetch(
      `${baseUrl}/api/v1/users/me/notification-preferences`,
      { headers: { authorization: "Bearer valid-token" } },
    );
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { preferences: base });
  });

  test("updates strict category preferences", async () => {
    const categories = { ...base.categories, reactions: false };
    const response = await fetch(
      `${baseUrl}/api/v1/users/me/notification-preferences`,
      authorizedJson("PUT", { categories }),
    );
    assert.equal(response.status, 200);
    assert.equal(lastOperation, "update");
    assert.equal(
      (
        (await response.json()) as {
          preferences: NotificationPreferencesDto;
        }
      ).preferences.categories.reactions,
      false,
    );
    assert.equal(
      (
        await fetch(
          `${baseUrl}/api/v1/users/me/notification-preferences`,
          authorizedJson("PUT", { categories, extra: true }),
        )
      ).status,
      400,
    );
  });

  test("sets and removes scoped mutes", async () => {
    const expiry = "2026-09-09T08:00:00.000Z";
    const organizationResponse = await fetch(
      `${baseUrl}/api/v1/users/me/notification-mutes/organizations/${organizationId}`,
      authorizedJson("PUT", { mutedUntil: expiry }),
    );
    assert.equal(organizationResponse.status, 200);
    assert.equal(lastOperation, "mute-organization");

    const conversationResponse = await fetch(
      `${baseUrl}/api/v1/users/me/notification-mutes/conversations/${conversationId}`,
      authorizedJson("PUT", { mutedUntil: null }),
    );
    assert.equal(conversationResponse.status, 200);
    assert.equal(lastOperation, "mute-conversation");

    const removeResponse = await fetch(
      `${baseUrl}/api/v1/users/me/notification-mutes/conversations/${conversationId}`,
      authorizedJson("DELETE"),
    );
    assert.equal(removeResponse.status, 200);
    assert.equal(lastOperation, "unmute-conversation");
  });
});
