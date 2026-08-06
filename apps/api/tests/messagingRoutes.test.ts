import assert from "node:assert/strict";
import { after, before, describe, test } from "node:test";
import http from "node:http";

import { ConversationType } from "@intouch/shared/conversations";
import type { RequestHandler } from "express";

import createApp from "../src/app.js";
import createDirectMessageController from "../src/modules/direct-messages/direct-message.controller.js";
import createDirectMessageRouter from "../src/modules/direct-messages/direct-message.routes.js";
import type { DirectMessageService } from "../src/modules/direct-messages/direct-message.service.js";
import createReadReceiptController from "../src/modules/read-receipts/read-receipt.controller.js";
import createReadReceiptRouter from "../src/modules/read-receipts/read-receipt.routes.js";
import type { ReadReceiptService } from "../src/modules/read-receipts/read-receipt.service.js";

const userId = "507f1f77bcf86cd799439011";
const recipientUserId = "507f1f77bcf86cd799439012";
const organizationId = "507f1f77bcf86cd799439013";
const conversationId = "507f1f77bcf86cd799439014";
const messageId = "507f1f77bcf86cd799439015";
const now = new Date("2026-08-03T12:00:00.000Z");
const directMessage = {
  id: conversationId,
  organizationId,
  type: ConversationType.DIRECT,
  peer: {
    id: recipientUserId,
    username: "recipient",
    displayName: "Recipient User",
  },
  createdAt: now,
  updatedAt: now,
  lastMessage: null,
  unreadCount: 0,
  readReceipt: null,
};
let created = true;
let receivedLimit: number | undefined;
let receivedRecipientId: string | undefined;
let receivedMessageId: string | undefined;

const directMessages: DirectMessageService = {
  create: async (_userId, _organizationId, input) => {
    receivedRecipientId = input.recipientUserId;
    return { created, directMessage };
  },
  list: async (_userId, _organizationId, query) => {
    receivedLimit = query.limit;
    return { directMessages: [directMessage], nextCursor: null };
  },
};

const readReceipts: ReadReceiptService = {
  advance: async (_userId, _conversationId, input) => {
    receivedMessageId = input.messageId;
    return {
      id: "507f1f77bcf86cd799439099",
      conversationId,
      userId,
      lastReadMessageId: input.messageId,
      lastReadAt: now,
    };
  },
};

const requireAccessToken: RequestHandler = (_req, res, next) => {
  res.locals.userId = userId;
  next();
};
const allowAuthenticatedAction: RequestHandler = (_req, _res, next) => next();

const app = createApp({
  directMessageRouter: createDirectMessageRouter(
    createDirectMessageController(directMessages),
    requireAccessToken,
    allowAuthenticatedAction,
  ),
  readReceiptRouter: createReadReceiptRouter(
    createReadReceiptController(readReceipts),
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

describe("direct-message and read-receipt routes", () => {
  test("returns 201 for a new DM and 200 for its idempotent replay", async () => {
    const url = `${baseUrl}/api/v1/organizations/${organizationId}/direct-messages`;
    const request = () =>
      fetch(url, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ recipientUserId }),
      });
    created = true;
    assert.equal((await request()).status, 201);
    created = false;
    assert.equal((await request()).status, 200);
    assert.equal(receivedRecipientId, recipientUserId);
  });

  test("coerces DM pagination and validates receipt bodies", async () => {
    const listResponse = await fetch(
      `${baseUrl}/api/v1/organizations/${organizationId}/direct-messages?limit=25`,
    );
    assert.equal(listResponse.status, 200);
    assert.equal(receivedLimit, 25);

    const receiptResponse = await fetch(
      `${baseUrl}/api/v1/conversations/${conversationId}/read-receipt`,
      {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ messageId }),
      },
    );
    assert.equal(receiptResponse.status, 200);
    assert.equal(receivedMessageId, messageId);
  });
});
