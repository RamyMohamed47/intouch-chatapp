import assert from "node:assert/strict";
import { describe, test } from "node:test";

import {
  channelReadReceiptsChangedEventSchema,
  conversationActivityEventSchema,
  conversationSocketSchema,
  membershipJoinedEventSchema,
  organizationSocketSchema,
  presenceEventSchema,
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

  test("validates strict membership joined events", () => {
    const organizationId = "507f1f77bcf86cd799439011";
    const userId = "507f1f77bcf86cd799439012";
    assert.deepEqual(
      membershipJoinedEventSchema.parse({ organizationId, userId }),
      { organizationId, userId },
    );
    assert.equal(
      membershipJoinedEventSchema.safeParse({
        organizationId,
        userId,
        displayName: "Must not be duplicated",
      }).success,
      false,
    );
  });

  test("validates strict presence events and serializes timestamps", () => {
    const userId = "507f1f77bcf86cd799439011";
    const lastSeenAt = new Date("2026-08-27T12:00:00.000Z");
    assert.deepEqual(
      presenceEventSchema.parse({
        userId,
        status: "OFFLINE",
        lastSeenAt,
      }),
      {
        userId,
        status: "OFFLINE",
        lastSeenAt: lastSeenAt.toISOString(),
      },
    );
    assert.equal(
      presenceEventSchema.safeParse({
        userId: "invalid",
        status: "ONLINE",
        lastSeenAt: null,
      }).success,
      false,
    );
    assert.equal(
      presenceEventSchema.safeParse({
        userId,
        status: "ONLINE",
        lastSeenAt,
      }).success,
      false,
    );
    assert.equal(
      presenceEventSchema.safeParse({
        userId,
        status: "ONLINE",
        lastSeenAt: null,
        organizationId: "507f1f77bcf86cd799439012",
      }).success,
      false,
    );
  });

  test("validates strict conversation activity and anonymous receipt invalidations", () => {
    const organizationId = "507f1f77bcf86cd799439011";
    const conversationId = "507f1f77bcf86cd799439012";
    const actorUserId = "507f1f77bcf86cd799439013";
    const activity = {
      organizationId,
      conversationId,
      conversationType: "DIRECT" as const,
      actorUserId,
      activityId: "3d46f75a-83c4-4ac6-a3cb-24aa830c77e8",
      kind: "MESSAGE_CREATED" as const,
    };
    assert.deepEqual(conversationActivityEventSchema.parse(activity), activity);
    assert.equal(
      conversationActivityEventSchema.safeParse({ ...activity, content: "no" })
        .success,
      false,
    );
    assert.deepEqual(
      channelReadReceiptsChangedEventSchema.parse({ conversationId }),
      { conversationId },
    );
    assert.equal(
      channelReadReceiptsChangedEventSchema.safeParse({
        conversationId,
        userId: actorUserId,
      }).success,
      false,
    );
  });
});
