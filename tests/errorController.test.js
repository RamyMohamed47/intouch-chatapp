import assert from "node:assert/strict";
import { describe, test } from "node:test";

import handleError from "../controllers/errorController.js";
import AppError from "../utils/appError.js";

process.env.NODE_ENV = "test";

const createResponse = () => {
  const response = {
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
  };

  return response;
};

describe("handleError", () => {
  test("sends operational errors to the client", () => {
    const err = new AppError("Message not found", 404);
    const res = createResponse();

    handleError(err, {}, res, () => {});

    assert.equal(res.statusCode, 404);
    assert.deepEqual(res.body, {
      status: "fail",
      message: "Message not found",
    });
  });

  test("hides programming errors from the client", () => {
    const err = new Error("Database driver crashed");
    const res = createResponse();

    handleError(err, {}, res, () => {});

    assert.equal(res.statusCode, 500);
    assert.deepEqual(res.body, {
      status: "error",
      message: "Something went wrong",
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

    handleError(err, {}, res, () => {});

    assert.equal(res.statusCode, 400);
    assert.deepEqual(res.body, {
      status: "fail",
      message: "Name is required. Message is required",
    });
  });
});
