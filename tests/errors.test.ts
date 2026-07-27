import assert from "node:assert/strict";
import { describe, test } from "node:test";

import AppError from "../src/errors/AppError.js";
import ForbiddenError from "../src/errors/ForbiddenError.js";
import NotFoundError from "../src/errors/NotFoundError.js";
import UnauthorizedError from "../src/errors/UnauthorizedError.js";
import ValidationError from "../src/errors/ValidationError.js";

describe("error classes", () => {
  test("AppError marks operational errors with status metadata", () => {
    const err = new AppError("Something broke", 500);

    assert.equal(err.name, "AppError");
    assert.equal(err.message, "Something broke");
    assert.equal(err.statusCode, 500);
    assert.equal(err.status, "error");
    assert.equal(err.isOperational, true);
  });

  test("ValidationError represents bad requests", () => {
    const err = new ValidationError("Name is required");

    assert.equal(err.name, "ValidationError");
    assert.equal(err.message, "Name is required");
    assert.equal(err.statusCode, 400);
    assert.equal(err.status, "fail");
  });

  test("NotFoundError represents missing resources", () => {
    const err = new NotFoundError("Message not found");

    assert.equal(err.name, "NotFoundError");
    assert.equal(err.message, "Message not found");
    assert.equal(err.statusCode, 404);
    assert.equal(err.status, "fail");
  });

  test("UnauthorizedError represents missing authentication", () => {
    const err = new UnauthorizedError();

    assert.equal(err.name, "UnauthorizedError");
    assert.equal(err.message, "Unauthorized");
    assert.equal(err.statusCode, 401);
    assert.equal(err.status, "fail");
  });

  test("ForbiddenError represents rejected authorization", () => {
    const err = new ForbiddenError();

    assert.equal(err.name, "ForbiddenError");
    assert.equal(err.message, "Forbidden");
    assert.equal(err.statusCode, 403);
    assert.equal(err.status, "fail");
  });
});
