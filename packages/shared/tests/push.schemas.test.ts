import assert from "node:assert/strict";
import { describe, test } from "node:test";

import {
  PushPlatform,
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
});
