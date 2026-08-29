import assert from "node:assert/strict";
import { after, before, describe, test } from "node:test";
import http from "node:http";

import {
  ChatWallpaperId,
  ChatWallpaperSource,
  type UpdateChatWallpaperInput,
} from "@intouch/shared/chat-wallpapers";
import type { RequestHandler } from "express";

import createApp from "../src/app.js";
import createChatWallpaperController from "../src/modules/chat-wallpapers/chat-wallpaper.controller.js";
import {
  createConversationChatWallpaperRouter,
  createUserChatWallpaperRouter,
} from "../src/modules/chat-wallpapers/chat-wallpaper.routes.js";
import type { ChatWallpaperService } from "../src/modules/chat-wallpapers/chat-wallpaper.service.js";

const userId = "507f1f77bcf86cd799439011";
const conversationId = "507f1f77bcf86cd799439012";
let receivedInput: UpdateChatWallpaperInput | undefined;
let resetConversationId: string | undefined;

const defaultWallpaper = {
  wallpaperId: ChatWallpaperId.INTOUCH_DOODLE,
  dimming: 35,
  source: ChatWallpaperSource.DEFAULT,
};

const service: ChatWallpaperService = {
  getDefault: async () => defaultWallpaper,
  setDefault: async (_userId, input) => {
    receivedInput = input;
    return { ...input, source: ChatWallpaperSource.DEFAULT };
  },
  getForConversation: async () => defaultWallpaper,
  setForConversation: async (_userId, _conversationId, input) => {
    receivedInput = input;
    return { ...input, source: ChatWallpaperSource.CONVERSATION };
  },
  resetConversation: async (_userId, targetConversationId) => {
    resetConversationId = targetConversationId;
  },
};

const requireAccessToken: RequestHandler = (_req, res, next) => {
  res.locals.userId = userId;
  next();
};
const allowMutation: RequestHandler = (_req, _res, next) => next();
const controller = createChatWallpaperController(service);
const app = createApp({
  conversationChatWallpaperRouter: createConversationChatWallpaperRouter(
    controller,
    requireAccessToken,
    allowMutation,
  ),
  userChatWallpaperRouter: createUserChatWallpaperRouter(
    controller,
    requireAccessToken,
    allowMutation,
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

describe("chat wallpaper routes", () => {
  test("returns the authenticated user's resolved default", async () => {
    const response = await fetch(`${baseUrl}/api/v1/users/me/chat-wallpaper`);
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { wallpaper: defaultWallpaper });
  });

  test("normalizes plain wallpaper updates", async () => {
    const response = await fetch(`${baseUrl}/api/v1/users/me/chat-wallpaper`, {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        wallpaperId: ChatWallpaperId.NONE,
        dimming: 60,
      }),
    });
    assert.equal(response.status, 200);
    assert.deepEqual(receivedInput, {
      wallpaperId: ChatWallpaperId.NONE,
      dimming: 0,
    });
  });

  test("sets and resets a conversation override", async () => {
    const url = `${baseUrl}/api/v1/conversations/${conversationId}/chat-wallpaper`;
    const update = await fetch(url, {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        wallpaperId: ChatWallpaperId.SCENERY_FOREST,
        dimming: 45,
      }),
    });
    assert.equal(update.status, 200);
    assert.deepEqual(await update.json(), {
      wallpaper: {
        wallpaperId: ChatWallpaperId.SCENERY_FOREST,
        dimming: 45,
        source: ChatWallpaperSource.CONVERSATION,
      },
    });

    const reset = await fetch(url, { method: "DELETE" });
    assert.equal(reset.status, 204);
    assert.equal(resetConversationId, conversationId);
  });

  test("rejects malformed IDs and unknown body fields", async () => {
    const invalidId = await fetch(
      `${baseUrl}/api/v1/conversations/not-an-id/chat-wallpaper`,
    );
    assert.equal(invalidId.status, 400);

    const unknownField = await fetch(
      `${baseUrl}/api/v1/users/me/chat-wallpaper`,
      {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          wallpaperId: ChatWallpaperId.ABSTRACT_AURORA,
          dimming: 20,
          imageUrl: "https://example.com/remote.png",
        }),
      },
    );
    assert.equal(unknownField.status, 400);
  });
});
