import assert from "node:assert/strict";
import { describe, test } from "node:test";

import createPresenceService from "../src/modules/presence/presence.service.js";
import {
  PresenceStatus,
  type PresenceView,
} from "../src/modules/presence/presence.types.js";
import createTypingService from "../src/modules/typing/typing.service.js";
import type { TypingUpdate } from "../src/modules/typing/typing.realtime.js";

const userId = "507f1f77bcf86cd799439011";
const organizationId = "507f1f77bcf86cd799439012";
const conversationId = "507f1f77bcf86cd799439013";

const wait = (milliseconds: number) =>
  new Promise((resolve) => setTimeout(resolve, milliseconds));

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

  test("expires typing and keeps another active socket authoritative", async () => {
    const updates: TypingUpdate[] = [];
    const typing = createTypingService({
      realtime: {
        typingUpdated(update) {
          updates.push(update);
        },
      },
      timeoutMs: 20,
    });

    typing.start(conversationId, userId, "socket-1");
    typing.start(conversationId, userId, "socket-2");
    typing.stop(conversationId, userId, "socket-1");
    assert.equal(updates.length, 1);
    typing.stop(conversationId, userId, "socket-2");
    assert.deepEqual(
      updates.map(({ isTyping }) => isTyping),
      [true, false],
    );

    typing.start(conversationId, userId, "socket-3");
    await wait(25);
    assert.deepEqual(
      updates.map(({ isTyping }) => isTyping),
      [true, false, true, false],
    );
  });
});
