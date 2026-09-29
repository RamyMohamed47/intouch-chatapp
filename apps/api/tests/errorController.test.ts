import assert from "node:assert/strict";
import { describe, test } from "node:test";

import type { NextFunction, Request, Response } from "express";

import AppError from "../src/errors/AppError.js";
import handleError, {
  getRequestRejectionLogContext,
  shouldCaptureError,
} from "../src/middleware/errorHandler.js";

process.env.NODE_ENV = "test";

interface MockResponse {
  body: unknown;
  headersSent: boolean;
  statusCode: number | null;
  status(code: number): MockResponse;
  json(body: unknown): MockResponse;
  getHeader(name: string): string | undefined;
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

  getHeader() {
    return undefined;
  },
});

const noopNext: NextFunction = () => {};

describe("handleError", () => {
  test("builds diagnosable rejection logs without concrete URL parameters", () => {
    const err = new AppError(
      "Leave your current voice session before joining another",
      409,
      "VOICE_SESSION_ACTIVE",
    );
    const req = {
      baseUrl: "/api/v1/conversations",
      method: "POST",
      path: "/abc123/voice/join",
      route: { path: "/:conversationId/voice/join" },
    } as Request;

    assert.deepEqual(getRequestRejectionLogContext(err, req), {
      code: "VOICE_SESSION_ACTIVE",
      method: "POST",
      reason: "Leave your current voice session before joining another",
      route: "/api/v1/conversations/:conversationId/voice/join",
      statusCode: 409,
    });
  });

  test("does not include an unmatched request URL in rejection logs", () => {
    const err = new AppError(
      "Cannot find /api/v1/private-value?token=secret on this server",
      404,
      "NOT_FOUND",
    );
    const req = {
      baseUrl: "",
      method: "GET",
      path: "/api/v1/private-value",
    } as Request;

    assert.deepEqual(getRequestRejectionLogContext(err, req), {
      code: "NOT_FOUND",
      method: "GET",
      reason: "Route not found",
      route: "unmatched",
      statusCode: 404,
    });
  });

  test("preserves the reason for middleware rejections before route matching", () => {
    const err = new AppError(
      "Bearer access token is required",
      401,
      "UNAUTHORIZED",
    );
    const req = {
      baseUrl: "/api/v1/conversations",
      method: "GET",
      path: "/abc123",
    } as Request;

    assert.deepEqual(getRequestRejectionLogContext(err, req), {
      code: "UNAUTHORIZED",
      method: "GET",
      reason: "Bearer access token is required",
      route: "unmatched",
      statusCode: 401,
    });
  });

  test("captures unexpected failures but not expected client errors", () => {
    assert.equal(shouldCaptureError(new Error("unexpected")), true);
    assert.equal(
      shouldCaptureError(new AppError("Missing", 404, "NOT_FOUND")),
      false,
    );
    assert.equal(
      shouldCaptureError(
        new AppError("Unavailable", 503, "SERVICE_UNAVAILABLE"),
      ),
      true,
    );
  });
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
