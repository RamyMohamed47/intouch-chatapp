import assert from "node:assert/strict";
import { describe, test } from "node:test";

import type { NextFunction, Request, Response } from "express";

import type { MessageBroadcaster } from "../src/broadcasting/messageBroadcaster.js";
import type { MessageRecord } from "../src/contracts/message.js";
import createMessageController from "../src/modules/message/message.controller.js";
import type { MessageService } from "../src/modules/message/message.service.js";

interface MockResponse {
  body: unknown;
  statusCode: number | null;
  status(code: number): MockResponse;
  json(body: unknown): MockResponse;
}

const createResponse = (): MockResponse => ({
  body: null,
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

describe("messageController", () => {
  test("sends created messages and broadcasts once", async () => {
    const created: MessageRecord = {
      _id: "message-1",
      name: "Ramy",
      message: "Hello",
    };
    const service: MessageService = {
      getAllMessages: async () => [],
      createMessage: async () => created,
    };
    const broadcastedMessages: MessageRecord[] = [];
    const broadcaster: MessageBroadcaster = {
      broadcastMessage(message) {
        broadcastedMessages.push(message);
      },
    };
    const controller = createMessageController(service, broadcaster);
    const req = {
      body: {
        name: "Ramy",
        message: "Hello",
      },
    } as Request;
    const res = createResponse();
    const next: NextFunction = (err?: unknown) => {
      throw err instanceof Error ? err : new Error("Unexpected next call");
    };

    await controller.createMessage(req, res as unknown as Response, next);

    assert.equal(res.statusCode, 201);
    assert.equal(res.body, created);
    assert.deepEqual(broadcastedMessages, [created]);
  });

  test("passes create failures to the async error pipeline without broadcasting", async () => {
    const failure = new Error("Repository failed");
    const service: MessageService = {
      getAllMessages: async () => [],
      createMessage: async () => {
        throw failure;
      },
    };
    let broadcastCount = 0;
    const broadcaster: MessageBroadcaster = {
      broadcastMessage() {
        broadcastCount += 1;
      },
    };
    const controller = createMessageController(service, broadcaster);
    const req = {
      body: {
        name: "Ramy",
        message: "Hello",
      },
    } as Request;
    const res = createResponse();
    const nextError = await new Promise<unknown>((resolve) => {
      controller.createMessage(req, res as unknown as Response, resolve);
    });

    assert.equal(nextError, failure);
    assert.equal(broadcastCount, 0);
    assert.equal(res.statusCode, null);
    assert.equal(res.body, null);
  });
});
