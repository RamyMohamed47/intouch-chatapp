import assert from "node:assert/strict";
import http from "node:http";
import { after, before, describe, test } from "node:test";

import type { PushDeviceDto } from "@intouch/shared/push";
import type { RequestHandler } from "express";

import createApp from "../src/app.js";
import UnauthorizedError from "../src/errors/UnauthorizedError.js";
import type { AuthLocals } from "../src/modules/auth/auth.types.js";
import { createPushDeviceController } from "../src/modules/push/push-device.controller.js";
import { createPushDeviceRouter } from "../src/modules/push/push-device.routes.js";
import type { PushDeviceService } from "../src/modules/push/push-device.service.js";

const userId = "507f1f77bcf86cd799439011";
const installationId = "6caea54e-3f3a-4bb2-a620-f43ee8e08a98";
const pushDevice: PushDeviceDto = {
  installationId,
  platform: "ANDROID",
  enabled: true,
  updatedAt: "2026-09-08T12:00:00.000Z",
};

let registeredToken: string | undefined;
let removedInstallationId: string | undefined;
const service: PushDeviceService = {
  register: async (receivedUserId, receivedInstallationId, input) => {
    assert.equal(receivedUserId, userId);
    assert.equal(receivedInstallationId, installationId);
    registeredToken = input.expoPushToken;
    return pushDevice;
  },
  remove: async (receivedUserId, receivedInstallationId) => {
    assert.equal(receivedUserId, userId);
    removedInstallationId = receivedInstallationId;
  },
};
const requireAccessToken: RequestHandler = (req, res, next) => {
  if (req.get("authorization") !== "Bearer valid-token") {
    next(new UnauthorizedError());
    return;
  }
  (res.locals as AuthLocals).userId = userId;
  next();
};
const allowMutation: RequestHandler = (_req, _res, next) => next();
const app = createApp({
  pushDeviceRouter: createPushDeviceRouter(
    createPushDeviceController(service),
    requireAccessToken,
    allowMutation,
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

describe("push-device routes", () => {
  test("requires authentication", async () => {
    const response = await fetch(
      `${baseUrl}/api/v1/users/me/push-devices/${installationId}`,
      { method: "PUT" },
    );
    assert.equal(response.status, 401);
  });

  test("registers and removes an installation without exposing its token", async () => {
    const response = await fetch(
      `${baseUrl}/api/v1/users/me/push-devices/${installationId}`,
      {
        method: "PUT",
        headers: {
          authorization: "Bearer valid-token",
          "content-type": "application/json",
        },
        body: JSON.stringify({
          expoPushToken: "ExponentPushToken[abcdefghijklmnopqrstuv]",
          platform: "ANDROID",
        }),
      },
    );
    assert.equal(response.status, 200);
    assert.equal(registeredToken, "ExponentPushToken[abcdefghijklmnopqrstuv]");
    const body = (await response.json()) as Record<string, unknown>;
    assert.equal(JSON.stringify(body).includes("ExponentPushToken"), false);

    const removeResponse = await fetch(
      `${baseUrl}/api/v1/users/me/push-devices/${installationId}`,
      {
        method: "DELETE",
        headers: { authorization: "Bearer valid-token" },
      },
    );
    assert.equal(removeResponse.status, 204);
    assert.equal(removedInstallationId, installationId);
  });

  test("rejects malformed installation IDs and unknown fields", async () => {
    const invalidId = await fetch(
      `${baseUrl}/api/v1/users/me/push-devices/not-a-uuid`,
      {
        method: "DELETE",
        headers: { authorization: "Bearer valid-token" },
      },
    );
    assert.equal(invalidId.status, 400);

    const unknownField = await fetch(
      `${baseUrl}/api/v1/users/me/push-devices/${installationId}`,
      {
        method: "PUT",
        headers: {
          authorization: "Bearer valid-token",
          "content-type": "application/json",
        },
        body: JSON.stringify({
          expoPushToken: "ExponentPushToken[abcdefghijklmnopqrstuv]",
          platform: "ANDROID",
          userId,
        }),
      },
    );
    assert.equal(unknownField.status, 400);
  });
});
