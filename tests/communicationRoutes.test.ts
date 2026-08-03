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
};

let receivedCategoryName: string | undefined;
let receivedVisibility: string | undefined;
let receivedHistoryLimit: number | undefined;

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
  create: async () => message,
  update: async () => message,
  delete: async () => undefined,
};

const requireAccessToken: RequestHandler = (_req, res, next) => {
  res.locals.userId = userId;
  next();
};

const categoryController = createCategoryController(categories);
const conversationController = createConversationController(conversations);
const messageController = createMessageController(messages);
const app = createApp({
  categoryRouter: createCategoryRouter(categoryController, requireAccessToken),
  conversationMessageRouter: createConversationMessageRouter(
    messageController,
    requireAccessToken,
  ),
  conversationRouter: createConversationRouter(
    conversationController,
    requireAccessToken,
  ),
  messageRouter: createMessageRouter(messageController, requireAccessToken),
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
});
