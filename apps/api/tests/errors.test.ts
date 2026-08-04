import assert from "node:assert/strict";
import { describe, test } from "node:test";

import AppError from "../src/errors/AppError.js";
import ForbiddenError from "../src/errors/ForbiddenError.js";
import NotFoundError from "../src/errors/NotFoundError.js";
import UnauthorizedError from "../src/errors/UnauthorizedError.js";
import ValidationError from "../src/errors/ValidationError.js";

describe("error classes", () => {
  test("AppError marks operational errors with response metadata", () => {
    const err = new AppError("Something broke", 500, "INTERNAL_SERVER_ERROR");

    assert.equal(err.name, "AppError");
    assert.equal(err.message, "Something broke");
    assert.equal(err.code, "INTERNAL_SERVER_ERROR");
    assert.equal(err.statusCode, 500);
    assert.equal(err.isOperational, true);
  });

  test("ValidationError represents bad requests", () => {
    const err = new ValidationError("Name is required");

    assert.equal(err.name, "ValidationError");
    assert.equal(err.message, "Name is required");
    assert.equal(err.code, "VALIDATION_ERROR");
    assert.equal(err.statusCode, 400);
  });

  test("NotFoundError represents missing resources", () => {
    const err = new NotFoundError("Message not found");

    assert.equal(err.name, "NotFoundError");
    assert.equal(err.message, "Message not found");
    assert.equal(err.code, "NOT_FOUND");
    assert.equal(err.statusCode, 404);
  });

  test("UnauthorizedError represents missing authentication", () => {
    const err = new UnauthorizedError();

    assert.equal(err.name, "UnauthorizedError");
    assert.equal(err.message, "Unauthorized");
    assert.equal(err.code, "UNAUTHORIZED");
    assert.equal(err.statusCode, 401);
  });

  test("ForbiddenError represents rejected authorization", () => {
    const err = new ForbiddenError();

    assert.equal(err.name, "ForbiddenError");
    assert.equal(err.message, "Forbidden");
    assert.equal(err.code, "FORBIDDEN");
    assert.equal(err.statusCode, 403);
  });
});
