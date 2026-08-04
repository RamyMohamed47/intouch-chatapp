import assert from "node:assert/strict";
import { describe, test } from "node:test";

import type { NextFunction, Request, Response } from "express";

import createMessageController from "../src/modules/message/message.controller.js";
import type { MessageService } from "../src/modules/message/message.service.js";
import {
  MessageType,
  type MessageRecord,
} from "../src/modules/message/message.types.js";

const now = new Date("2026-08-03T00:00:00.000Z");
const message: MessageRecord = {
  id: "507f1f77bcf86cd799439013",
  conversationId: "507f1f77bcf86cd799439012",
  senderId: "507f1f77bcf86cd799439011",
  content: "Hello",
  messageType: MessageType.TEXT,
  editedAt: null,
  deletedAt: null,
  createdAt: now,
  updatedAt: now,
};

interface MockResponse {
  body: unknown;
  locals: Record<string, unknown>;
  statusCode: number | null;
  status(code: number): MockResponse;
  json(body: unknown): MockResponse;
}

const createResponse = (): MockResponse => ({
  body: null,
  locals: { userId: message.senderId },
  statusCode: null,
  status(code) {
    this.statusCode = code;
    return this;
  },
  json(body) {
    this.body = body;
    return this;
  },
});

const createService = (
  overrides: Partial<MessageService> = {},
): MessageService => ({
  list: async () => ({ messages: [], nextCursor: null }),
  create: async () => message,
  update: async () => message,
  delete: async () => undefined,
  ...overrides,
});

describe("messageController", () => {
  test("returns the created conversation message", async () => {
    const controller = createMessageController(createService());
    const req = {
      body: { content: "Hello" },
      params: { conversationId: message.conversationId },
    } as unknown as Request;
    const res = createResponse();
    const next: NextFunction = (error?: unknown) => {
      if (error instanceof Error) throw error;
      if (error !== undefined) throw new Error("Unexpected non-error value");
    };

    await controller.create(req, res as unknown as Response, next);

    assert.equal(res.statusCode, 201);
    assert.deepEqual(res.body, { message });
  });

  test("passes service failures to the error pipeline", async () => {
    const failure = new Error("Repository failed");
    const controller = createMessageController(
      createService({
        create: async () => {
          throw failure;
        },
      }),
    );
    const req = {
      body: { content: "Hello" },
      params: { conversationId: message.conversationId },
    } as unknown as Request;
    const res = createResponse();
    const nextError = await new Promise<unknown>((resolve) => {
      controller.create(req, res as unknown as Response, resolve);
    });

    assert.equal(nextError, failure);
    assert.equal(res.statusCode, null);
  });
});
