import assert from "node:assert/strict";
import { after, before, describe, test } from "node:test";
import http from "node:http";

import {
  ConversationType,
  ConversationVisibility,
} from "@intouch/shared/conversations";
import type { RequestHandler } from "express";

import createApp from "../src/app.js";
import createCategoryController from "../src/modules/categories/category.controller.js";
import createCategoryRouter from "../src/modules/categories/category.routes.js";
import type { CategoryService } from "../src/modules/categories/category.service.js";
import createConversationController from "../src/modules/conversations/conversation.controller.js";
import {
  createConversationRouter,
  createOrganizationConversationRouter,
} from "../src/modules/conversations/conversation.routes.js";
import type { ConversationService } from "../src/modules/conversations/conversation.service.js";
import createMessageController from "../src/modules/message/message.controller.js";
import {
  createConversationMessageRouter,
  createMessageRouter,
} from "../src/modules/message/message.routes.js";
import type { MessageService } from "../src/modules/message/message.service.js";
import { MessageType } from "../src/modules/message/message.types.js";
import createMessageReactionController from "../src/modules/message-reactions/message-reaction.controller.js";
import createMessageReactionRouter from "../src/modules/message-reactions/message-reaction.routes.js";
import type { MessageReactionService } from "../src/modules/message-reactions/message-reaction.service.js";

const userId = "507f1f77bcf86cd799439011";
const organizationId = "507f1f77bcf86cd799439012";
const categoryId = "507f1f77bcf86cd799439013";
const conversationId = "507f1f77bcf86cd799439014";
const messageId = "507f1f77bcf86cd799439015";
const now = new Date("2026-08-03T00:00:00.000Z");
const category = {
  id: categoryId,
  organizationId,
  name: "Product",
  position: 0,
  createdAt: now,
  updatedAt: now,
};
const conversation = {
  id: conversationId,
  organizationId,
  categoryId,
  name: "General",
  type: ConversationType.CHANNEL,
  visibility: ConversationVisibility.PUBLIC,
  position: 0,
  createdAt: now,
  updatedAt: now,
};
const conversationSummary = {
  ...conversation,
  lastMessage: null,
  unreadCount: 0,
  readReceipt: null,
};
const message = {
  id: messageId,
  conversationId,
  senderId: userId,
  content: "hello",
  messageType: MessageType.TEXT,
  editedAt: null,
  deletedAt: null,
  createdAt: now,
  updatedAt: now,
  reactions: [],
  currentUserReaction: null,
};

let receivedCategoryName: string | undefined;
let receivedVisibility: string | undefined;
let receivedHistoryLimit: number | undefined;
let receivedReactionEmoji: string | undefined;
let receivedReactionUserLimit: number | undefined;

const categories: CategoryService = {
  create: async (_userId, _organizationId, input) => {
    receivedCategoryName = input.name;
    return category;
  },
  list: async () => [category],
  update: async () => category,
  delete: async () => undefined,
};

const conversations: ConversationService = {
  getAccessible: async () => conversation,
  getAccessibleInContext: async () => conversation,
  summarize: async () => [conversationSummary],
  create: async (_userId, _organizationId, input) => {
    receivedVisibility = input.visibility;
    return conversation;
  },
  list: async () => [conversationSummary],
  getById: async () => conversationSummary,
  update: async () => conversation,
  delete: async () => undefined,
  listParticipants: async () => [],
  addParticipant: async () => ({
    id: "507f1f77bcf86cd799439016",
    organizationId,
    conversationId,
    userId,
    addedByUserId: userId,
    joinedAt: now,
  }),
  removeParticipant: async () => undefined,
};

const messages: MessageService = {
  list: async (_userId, _conversationId, query) => {
    receivedHistoryLimit = query.limit;
    return { messages: [message], nextCursor: null };
  },
  context: async () => ({
    anchorMessageId: messageId,
    messages: [message],
    hasEarlier: false,
    hasLater: false,
  }),
  create: async () => message,
  update: async () => message,
  delete: async () => undefined,
};
const reactionState = (emoji: string | null) => ({
  messageId,
  reactions: emoji ? [{ emoji, count: 1 }] : [],
  currentUserReaction: emoji,
});
const messageReactions: MessageReactionService = {
  decorate: async (_userId, _conversation, records) =>
    records.map((record) => ({
      ...record,
      reactions: [],
      currentUserReaction: null,
    })),
  getState: async () => reactionState(null),
  set: async (_userId, _messageId, input) => {
    receivedReactionEmoji = input.emoji;
    return reactionState(input.emoji);
  },
  remove: async () => reactionState(null),
  listUsers: async (_userId, _messageId, query) => {
    receivedReactionUserLimit = query.limit;
    return {
      messageId,
      emoji: query.emoji,
      total: 1,
      users: [{ id: userId, username: "ramy", displayName: "Ramy Mohamed" }],
      nextCursor: null,
    };
  },
};

const requireAccessToken: RequestHandler = (_req, res, next) => {
  res.locals.userId = userId;
  next();
};
const allowAuthenticatedAction: RequestHandler = (_req, _res, next) => next();

const categoryController = createCategoryController(categories);
const conversationController = createConversationController(conversations);
const messageController = createMessageController(messages);
const messageReactionController =
  createMessageReactionController(messageReactions);
const app = createApp({
  categoryRouter: createCategoryRouter(categoryController, requireAccessToken),
  conversationMessageRouter: createConversationMessageRouter(
    messageController,
    requireAccessToken,
    allowAuthenticatedAction,
  ),
  conversationRouter: createConversationRouter(
    conversationController,
    requireAccessToken,
  ),
  messageRouter: createMessageRouter(
    messageController,
    requireAccessToken,
    allowAuthenticatedAction,
  ),
  messageReactionRouter: createMessageReactionRouter(
    messageReactionController,
    requireAccessToken,
    allowAuthenticatedAction,
  ),
  organizationConversationRouter: createOrganizationConversationRouter(
    conversationController,
    requireAccessToken,
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

describe("category, conversation, and message routes", () => {
  test("normalizes category creation through the shared contract", async () => {
    const response = await fetch(
      `${baseUrl}/api/v1/organizations/${organizationId}/categories`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name: "  Product  " }),
      },
    );
    assert.equal(response.status, 201);
    assert.equal(receivedCategoryName, "Product");
  });

  test("defaults channel conversations to public", async () => {
    const response = await fetch(
      `${baseUrl}/api/v1/organizations/${organizationId}/conversations`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ categoryId, name: "General" }),
      },
    );
    assert.equal(response.status, 201);
    assert.equal(receivedVisibility, ConversationVisibility.PUBLIC);
  });

  test("validates and coerces message history queries", async () => {
    const response = await fetch(
      `${baseUrl}/api/v1/conversations/${conversationId}/messages?limit=25`,
    );
    assert.equal(response.status, 200);
    assert.equal(receivedHistoryLimit, 25);
  });

  test("returns exact message context", async () => {
    const response = await fetch(
      `${baseUrl}/api/v1/conversations/${conversationId}/messages/${messageId}/context`,
    );
    const body = (await response.json()) as {
      anchorMessageId: string;
      hasEarlier: boolean;
      hasLater: boolean;
    };
    assert.equal(response.status, 200);
    assert.equal(body.anchorMessageId, messageId);
    assert.equal(body.hasEarlier, false);
    assert.equal(body.hasLater, false);
  });

  test("rejects malformed message content", async () => {
    const response = await fetch(
      `${baseUrl}/api/v1/conversations/${conversationId}/messages`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ content: "   " }),
      },
    );
    const body = (await response.json()) as { error: { code: string } };
    assert.equal(response.status, 400);
    assert.equal(body.error.code, "VALIDATION_ERROR");
  });

  test("redacts messages through the item resource", async () => {
    const response = await fetch(`${baseUrl}/api/v1/messages/${messageId}`, {
      method: "DELETE",
    });
    assert.equal(response.status, 204);
    assert.equal(await response.text(), "");
  });

  test("sets, lists, and removes a personalized message reaction", async () => {
    const setResponse = await fetch(
      `${baseUrl}/api/v1/messages/${messageId}/reactions/me`,
      {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ emoji: "👍" }),
      },
    );
    assert.equal(setResponse.status, 200);
    assert.equal(receivedReactionEmoji, "👍");
    const stateResponse = await fetch(
      `${baseUrl}/api/v1/messages/${messageId}/reactions`,
    );
    assert.equal(stateResponse.status, 200);
    const usersResponse = await fetch(
      `${baseUrl}/api/v1/messages/${messageId}/reactions/users?emoji=${encodeURIComponent("👍")}&limit=20`,
    );
    assert.equal(usersResponse.status, 200);
    assert.equal(receivedReactionUserLimit, 20);
    const usersBody = (await usersResponse.json()) as Record<string, unknown>;
    assert.equal(usersBody.messageId, messageId);
    assert.equal("reactionUsers" in usersBody, false);
    const deleteResponse = await fetch(
      `${baseUrl}/api/v1/messages/${messageId}/reactions/me`,
      { method: "DELETE" },
    );
    assert.equal(deleteResponse.status, 200);
  });

  test("rejects non-emoji reaction input", async () => {
    const response = await fetch(
      `${baseUrl}/api/v1/messages/${messageId}/reactions/me`,
      {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ emoji: "not emoji" }),
      },
    );
    assert.equal(response.status, 400);
  });
});
