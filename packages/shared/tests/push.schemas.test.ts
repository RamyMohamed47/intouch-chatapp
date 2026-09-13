import assert from "node:assert/strict";
import { describe, test } from "node:test";

import {
  CallPushEventType,
  PushPlatform,
  callPushDataSchema,
  pushDeviceResponseSchema,
  registerPushDeviceSchema,
} from "../push/index.js";

describe("push contracts", () => {
  test("accepts strict Expo device registration", () => {
    const input = {
      platform: PushPlatform.ANDROID,
      expoPushToken: "ExpoPushToken[example_1234567890]",
    };
    assert.deepEqual(registerPushDeviceSchema.parse(input), input);
    assert.equal(
      registerPushDeviceSchema.safeParse({ ...input, userId: "hidden" })
        .success,
      false,
    );
  });

  test("never exposes the provider token in device responses", () => {
    const response = {
      pushDevice: {
        installationId: "89e46978-2270-438c-93e1-9c32506ea6ed",
        platform: PushPlatform.ANDROID,
        enabled: true,
        updatedAt: "2026-09-08T12:00:00.000Z",
      },
    };
    assert.deepEqual(pushDeviceResponseSchema.parse(response), response);
    assert.equal(
      pushDeviceResponseSchema.safeParse({
        pushDevice: { ...response.pushDevice, expoPushToken: "secret" },
      }).success,
      false,
    );
  });

  test("validates minimal call alert payloads without participant details", () => {
    const incoming = {
      type: CallPushEventType.INCOMING,
      callId: "507f1f77bcf86cd799439011",
      organizationId: "507f1f77bcf86cd799439012",
      conversationId: "507f1f77bcf86cd799439013",
      mediaMode: "VIDEO",
      startedAt: "2026-09-13T00:00:00.000Z",
    };
    assert.deepEqual(callPushDataSchema.parse(incoming), incoming);
    assert.deepEqual(
      callPushDataSchema.parse({
        type: CallPushEventType.STATE_CHANGED,
        callId: incoming.callId,
      }),
      {
        type: CallPushEventType.STATE_CHANGED,
        callId: incoming.callId,
      },
    );
    assert.equal(
      callPushDataSchema.safeParse({ ...incoming, callerUserId: "private" })
        .success,
      false,
    );
  });
});
