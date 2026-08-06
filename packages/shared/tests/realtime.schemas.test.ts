import assert from "node:assert/strict";
import { describe, test } from "node:test";

import {
  conversationSocketSchema,
  organizationSocketSchema,
  socketConnectionErrorSchema,
} from "../realtime/index.js";

describe("shared realtime schemas", () => {
  test("accepts strict conversation and organization socket payloads", () => {
    const id = "507f1f77bcf86cd799439011";
    assert.deepEqual(conversationSocketSchema.parse({ conversationId: id }), {
      conversationId: id,
    });
    assert.deepEqual(organizationSocketSchema.parse({ organizationId: id }), {
      organizationId: id,
    });
    assert.equal(
      conversationSocketSchema.safeParse({ conversationId: id, extra: true })
        .success,
      false,
    );
  });

  test("validates strict Socket.IO connection errors", () => {
    assert.deepEqual(
      socketConnectionErrorSchema.parse({
        code: "TOO_MANY_REQUESTS",
        message: "Too many realtime connection attempts",
        retryAfterMs: 2_000,
      }),
      {
        code: "TOO_MANY_REQUESTS",
        message: "Too many realtime connection attempts",
        retryAfterMs: 2_000,
      },
    );
    assert.equal(
      socketConnectionErrorSchema.safeParse({
        code: "UNAUTHORIZED",
        message: "Invalid access token",
        extra: true,
      }).success,
      false,
    );
  });
});
