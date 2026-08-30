import assert from "node:assert/strict";
import { after, before, describe, test } from "node:test";
import http from "node:http";

import { UploadPurpose } from "@intouch/shared/uploads";
import express, { type RequestHandler } from "express";

import handleError from "../src/middleware/errorHandler.js";
import type { UploadController } from "../src/modules/uploads/upload.controller.js";
import { createUploadRouter } from "../src/modules/uploads/upload.routes.js";

const conversationId = "507f1f77bcf86cd799439011";
let server: http.Server;
let baseUrl = "";
let createCalls = 0;

const controller: UploadController = {
  create: (_req, res) => {
    createCalls += 1;
    res.status(201).json({ created: true });
  },
  complete: (_req, res) => res.status(200).json({ completed: true }),
  cancel: (_req, res) => res.status(204).send(),
  access: (_req, res) => res.status(200).json({ accessed: true }),
  setAvatar: (_req, res) => res.status(200).json({ updated: true }),
  removeAvatar: (_req, res) => res.status(200).json({ removed: true }),
};

const authenticate: RequestHandler = (_req, res, next) => {
  res.locals.userId = "507f1f77bcf86cd799439012";
  next();
};
const allow: RequestHandler = (_req, _res, next) => next();

before(async () => {
  const app = express();
  app.use(express.json());
  app.use(
    "/api/v1/uploads",
    createUploadRouter(controller, authenticate, allow),
  );
  app.use(handleError);
  server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  if (!address || typeof address === "string") {
    throw new Error("Expected an IP server address");
  }
  baseUrl = `http://127.0.0.1:${address.port}`;
});

after(async () => {
  await new Promise<void>((resolve, reject) =>
    server.close((error) => (error ? reject(error) : resolve())),
  );
});

describe("upload routes", () => {
  test("returns 413 before controller work for an oversized descriptor", async () => {
    const response = await fetch(`${baseUrl}/api/v1/uploads`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        purpose: UploadPurpose.MESSAGE_ATTACHMENT,
        conversationId,
        files: [
          {
            fileName: "large.pdf",
            contentType: "application/pdf",
            size: 25 * 1024 * 1024 + 1,
          },
        ],
      }),
    });
    assert.equal(response.status, 413);
    assert.deepEqual(await response.json(), {
      success: false,
      error: {
        code: "VALIDATION_ERROR",
        message: "File must not exceed 25 MB",
      },
    });
    assert.equal(createCalls, 0);
  });

  test("keeps strict request validation for supported-size requests", async () => {
    const invalid = await fetch(`${baseUrl}/api/v1/uploads`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        purpose: UploadPurpose.AVATAR,
        files: [{ fileName: "avatar.png", contentType: "image/png", size: 10 }],
        extra: true,
      }),
    });
    assert.equal(invalid.status, 400);

    const valid = await fetch(`${baseUrl}/api/v1/uploads`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        purpose: UploadPurpose.AVATAR,
        files: [{ fileName: "avatar.png", contentType: "image/png", size: 10 }],
      }),
    });
    assert.equal(valid.status, 201);
    assert.equal(createCalls, 1);
  });

  test("enforces the 5 MB organization-logo limit before controller work", async () => {
    const before = createCalls;
    const oversized = await fetch(`${baseUrl}/api/v1/uploads`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        purpose: UploadPurpose.ORGANIZATION_LOGO,
        files: [
          {
            fileName: "organization.webp",
            contentType: "image/webp",
            size: 5 * 1024 * 1024 + 1,
          },
        ],
      }),
    });
    assert.equal(oversized.status, 413);
    assert.deepEqual(await oversized.json(), {
      success: false,
      error: {
        code: "VALIDATION_ERROR",
        message: "Image must not exceed 5 MB",
      },
    });
    assert.equal(createCalls, before);

    const valid = await fetch(`${baseUrl}/api/v1/uploads`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        purpose: UploadPurpose.ORGANIZATION_LOGO,
        files: [
          {
            fileName: "organization.webp",
            contentType: "image/webp",
            size: 1024,
          },
        ],
      }),
    });
    assert.equal(valid.status, 201);
    assert.equal(createCalls, before + 1);
  });
});
