import assert from "node:assert/strict";
import { describe, test } from "node:test";

import type { NextFunction, Request, Response } from "express";

import AppError from "../src/errors/AppError.js";
import handleError from "../src/middleware/errorHandler.js";

process.env.NODE_ENV = "test";

interface MockResponse {
  body: unknown;
  headersSent: boolean;
  statusCode: number | null;
  status(code: number): MockResponse;
  json(body: unknown): MockResponse;
}

const createResponse = (): MockResponse => ({
  body: null,
  headersSent: false,
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

const noopNext: NextFunction = () => {};

describe("handleError", () => {
  test("sends operational errors to the client", () => {
    const err = new AppError("Message not found", 404, "NOT_FOUND");
    const res = createResponse();

    handleError(err, {} as Request, res as unknown as Response, noopNext);

    assert.equal(res.statusCode, 404);
    assert.deepEqual(res.body, {
      success: false,
      error: {
        code: "NOT_FOUND",
        message: "Message not found",
      },
    });
  });

  test("hides programming errors from the client", () => {
    const err = new Error("Database driver crashed");
    const res = createResponse();

    handleError(err, {} as Request, res as unknown as Response, noopNext);

    assert.equal(res.statusCode, 500);
    assert.deepEqual(res.body, {
      success: false,
      error: {
        code: "INTERNAL_SERVER_ERROR",
        message: "Something went wrong",
      },
    });
  });

  test("formats mongoose validation errors as bad requests", () => {
    const err = {
      name: "ValidationError",
      errors: {
        name: { message: "Name is required" },
        message: { message: "Message is required" },
      },
    };
    const res = createResponse();

    handleError(err, {} as Request, res as unknown as Response, noopNext);

    assert.equal(res.statusCode, 400);
    assert.deepEqual(res.body, {
      success: false,
      error: {
        code: "VALIDATION_ERROR",
        message: "Name is required. Message is required",
      },
    });
  });
});
