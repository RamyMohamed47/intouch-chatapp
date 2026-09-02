import assert from "node:assert/strict";
import { describe, test } from "node:test";

import { VoiceSessionKind } from "@intouch/shared/voice";

import { createInMemoryVoiceSessionStore } from "../src/modules/voice/index.js";
import type { VoiceSessionRecord } from "../src/modules/voice/voice.types.js";

const organizationId = "507f1f77bcf86cd799439011";
const conversationId = "507f1f77bcf86cd799439012";

const session = (
  userId: string,
  id: string,
  overrides: Partial<VoiceSessionRecord> = {},
): VoiceSessionRecord => ({
  id,
  kind: VoiceSessionKind.VOICE_CHANNEL,
  organizationId,
  conversationId,
  callId: null,
  userId,
  participantIdentity: id,
  providerRoomId: "opaque-room",
  connectedAt: null,
  ...overrides,
});

describe("voice session store", () => {
  test("enforces one session per user and permits explicit replacement", async () => {
    const store = createInMemoryVoiceSessionStore();
    const first = session("user-one", "00000000-0000-4000-8000-000000000001");
    const second = session("user-one", "00000000-0000-4000-8000-000000000002");

    assert.deepEqual(await store.reserve([first]), {
      capacityExceeded: false,
      conflict: null,
      replaced: [],
    });
    const conflict = await store.reserve([second]);
    assert.equal(conflict.conflict?.id, first.id);

    const replacement = await store.reserve([second], "user-one");
    assert.equal(replacement.conflict, null);
    assert.deepEqual(
      replacement.replaced.map(({ id }) => id),
      [first.id],
    );
    assert.equal((await store.getByUser("user-one"))?.id, second.id);
    assert.equal((await store.getById(second.id))?.userId, "user-one");

    assert.deepEqual(await store.releaseSessions([first]), []);
    assert.equal((await store.getByUser("user-one"))?.id, second.id);
  });

  test("counts pending reservations when enforcing channel capacity", async () => {
    const store = createInMemoryVoiceSessionStore();
    const first = session("user-one", "00000000-0000-4000-8000-000000000011");
    const second = session("user-two", "00000000-0000-4000-8000-000000000012");
    const third = session("user-three", "00000000-0000-4000-8000-000000000013");

    assert.equal(
      (await store.reserve([first], undefined, 2)).capacityExceeded,
      false,
    );
    assert.equal(
      (await store.reserve([second], undefined, 2)).capacityExceeded,
      false,
    );
    assert.equal(
      (await store.reserve([third], undefined, 2)).capacityExceeded,
      true,
    );
    assert.equal(await store.getByUser("user-three"), null);
    assert.equal(
      (await store.listReservedByConversation(conversationId)).length,
      2,
    );
  });

  test("exposes only connected sessions as occupancy and releases leases", async () => {
    const store = createInMemoryVoiceSessionStore();
    const pending = session("user-one", "00000000-0000-4000-8000-000000000021");
    await store.reserve([pending]);
    assert.deepEqual(await store.listByConversation(conversationId), []);

    const connected = await store.activate(
      pending.userId,
      pending.id,
      new Date("2026-09-01T00:00:00.000Z"),
    );
    assert.equal(connected?.participantIdentity, pending.id);
    assert.equal((await store.listByConversation(conversationId)).length, 1);
    assert.equal(await store.heartbeat(pending.userId, pending.id), true);

    assert.equal((await store.releaseSessions([pending])).length, 1);
    assert.equal(await store.getById(pending.id), null);
    assert.deepEqual(
      await store.listReservedByConversation(conversationId),
      [],
    );
  });

  test("deduplicates provider webhooks", async () => {
    const store = createInMemoryVoiceSessionStore();
    assert.equal(await store.claimWebhook("event-one"), true);
    assert.equal(await store.claimWebhook("event-one"), false);
    assert.equal(await store.claimWebhook("event-two"), true);
  });
});
