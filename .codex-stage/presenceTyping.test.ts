import assert from "node:assert/strict";
import { describe, test } from "node:test";

import createPresenceService from "../src/modules/presence/presence.service.js";
import {
  PresenceStatus,
  type PresenceView,
} from "../src/modules/presence/presence.types.js";
import createTypingService from "../src/modules/typing/typing.service.js";
import type { TypingUpdate } from "../src/modules/typing/typing.realtime.js";
import type { TypingExpiryScheduler } from "../src/modules/typing/typing.scheduler.js";

const userId = "507f1f77bcf86cd799439011";
const organizationId = "507f1f77bcf86cd799439012";
const conversationId = "507f1f77bcf86cd799439013";

const wait = (milliseconds: number) =>
  new Promise((resolve) => setTimeout(resolve, milliseconds));

const createControlledTypingScheduler = () => {
  const expirations = new Map<string, () => void>();
  let schedules = 0;
  const scheduler: TypingExpiryScheduler = {
    cancel(key) {
      expirations.delete(key);
    },
    schedule(key, _delayMs, expire) {
      schedules += 1;
      expirations.set(key, expire);
    },
  };

  return {
    expire(key: string) {
      const expiration = expirations.get(key);
      expirations.delete(key);
      expiration?.();
    },
    get schedules() {
      return schedules;
    },
    scheduler,
  };
};

describe("presence and typing runtime state", () => {
  test("tracks multiple sockets and delays the final offline transition", async () => {
    const updates: PresenceView[] = [];
    const persisted: Date[] = [];
    const lastSeenAt = new Date("2026-08-03T12:00:00.000Z");
    const presence = createPresenceService({
      memberships: {
        listForUser: async () => [
          {
            id: "membership",
            userId,
            organizationId,
            role: "MEMBER",
            joinedAt: lastSeenAt,
          },
        ],
      },
      now: () => lastSeenAt,
      offlineDelayMs: 20,
      realtime: {
        presenceUpdated(_organizationIds, update) {
          updates.push(update);
        },
      },
      users: {
        findLastSeenByIds: async () => [{ userId, lastSeenAt: null }],
        updateLastSeen: async (_userId, value) => {
          persisted.push(value);
        },
      },
    });

    await presence.markOnline(userId, "socket-1");
    await presence.markOnline(userId, "socket-2");
    await presence.markOffline(userId, "socket-1");
    assert.equal(await presence.isOnline(userId), true);
    await presence.markOffline(userId, "socket-2");
    await wait(5);
    await presence.markOnline(userId, "socket-3");
    await wait(25);
    assert.equal(persisted.length, 0);

    await presence.markOffline(userId, "socket-3");
    await wait(25);
    assert.deepEqual(persisted, [lastSeenAt]);
    assert.deepEqual(
      updates.map(({ status }) => status),
      [PresenceStatus.ONLINE, PresenceStatus.OFFLINE],
    );
  });

  test("hides historical last seen values while a user is online", async () => {
    const historicalLastSeen = new Date("2026-08-01T12:00:00.000Z");
    const finalLastSeen = new Date("2026-08-27T12:00:00.000Z");
    let persistedLastSeen = historicalLastSeen;
    const presence = createPresenceService({
      memberships: { listForUser: async () => [] },
      now: () => finalLastSeen,
      offlineDelayMs: 1,
      realtime: { presenceUpdated() {} },
      users: {
        findLastSeenByIds: async () => [
          { userId, lastSeenAt: persistedLastSeen },
        ],
        updateLastSeen: async (_userId, value) => {
          persistedLastSeen = value;
        },
      },
    });

    await presence.markOnline(userId, "socket-1");
    assert.deepEqual(await presence.getMany([userId]), [
      { userId, status: PresenceStatus.ONLINE, lastSeenAt: null },
    ]);

    await presence.markOffline(userId, "socket-1");
    await wait(10);
    assert.deepEqual(await presence.getMany([userId]), [
      {
        userId,
        status: PresenceStatus.OFFLINE,
        lastSeenAt: finalLastSeen,
      },
    ]);
  });

  test("emits idempotent heartbeats and stops after the final socket", () => {
    const updates: TypingUpdate[] = [];
    const controlledScheduler = createControlledTypingScheduler();
    const typing = createTypingService({
      realtime: {
        typingUpdated(update) {
          updates.push(update);
        },
      },
      scheduler: controlledScheduler.scheduler,
    });

    typing.start(conversationId, userId, "socket-1");
    typing.start(conversationId, userId, "socket-2");
    typing.stop(conversationId, userId, "socket-1");
    assert.deepEqual(
      updates.map(({ isTyping }) => isTyping),
      [true, true],
    );
    typing.stop(conversationId, userId, "socket-2");
    assert.deepEqual(
      updates.map(({ isTyping }) => isTyping),
      [true, true, false],
    );
  });

  test("renews expiry on every heartbeat and emits one final stop", () => {
    const updates: TypingUpdate[] = [];
    const controlledScheduler = createControlledTypingScheduler();
    const typing = createTypingService({
      realtime: {
        typingUpdated(update) {
          updates.push(update);
        },
      },
      scheduler: controlledScheduler.scheduler,
    });
    const key = `${conversationId}:${userId}`;

    typing.start(conversationId, userId, "socket-3");
    typing.start(conversationId, userId, "socket-3");
    assert.equal(controlledScheduler.schedules, 2);
    controlledScheduler.expire(key);
    controlledScheduler.expire(key);
    assert.deepEqual(
      updates.map(({ isTyping }) => isTyping),
      [true, true, false],
    );
  });

  test("disconnects emit false only after the final typing socket leaves", () => {
    const updates: TypingUpdate[] = [];
    const typing = createTypingService({
      realtime: {
        typingUpdated(update) {
          updates.push(update);
        },
      },
      scheduler: createControlledTypingScheduler().scheduler,
    });

    typing.start(conversationId, userId, "socket-1");
    typing.start(conversationId, userId, "socket-2");
    typing.disconnect("socket-1");
    typing.disconnect("socket-2");
    assert.deepEqual(
      updates.map(({ isTyping }) => isTyping),
      [true, true, false],
    );
  });
});
