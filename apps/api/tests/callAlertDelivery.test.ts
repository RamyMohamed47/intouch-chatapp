import assert from "node:assert/strict";
import { describe, test } from "node:test";

import { PushPlatform } from "@intouch/shared/push";
import { CallMediaMode, CallStatus } from "@intouch/shared/voice";

import {
  deliverCallAlert,
  type CallAlertDeliveryDependencies,
} from "../src/modules/push/call-alert.delivery.js";
import {
  CallAlertKind,
  CallAlertOutboxModel,
} from "../src/modules/push/call-alert.model.js";
import type { CallAlertOutboxRecord } from "../src/modules/push/call-alert.repository.js";
import { createPushTokenCipher } from "../src/modules/push/push.crypto.js";
import type { PushProviderMessage } from "../src/modules/push/push.types.js";
import type { CallSessionRecord } from "../src/modules/voice/voice.types.js";

const now = new Date("2026-09-13T00:00:00.000Z");
const call: CallSessionRecord = {
  id: "507f1f77bcf86cd799439011",
  organizationId: "507f1f77bcf86cd799439012",
  conversationId: "507f1f77bcf86cd799439013",
  callerUserId: "507f1f77bcf86cd799439014",
  recipientUserId: "507f1f77bcf86cd799439015",
  mediaMode: CallMediaMode.VIDEO,
  providerRoomId: "opaque-room",
  status: CallStatus.RINGING,
  endReason: null,
  startedAt: now,
  acceptedAt: null,
  answeredAt: null,
  endedAt: null,
  createdAt: now,
  updatedAt: now,
};
const record: CallAlertOutboxRecord = {
  id: "507f1f77bcf86cd799439016",
  callId: call.id,
  recipientUserId: call.recipientUserId,
  kind: CallAlertKind.INCOMING,
  attempts: 1,
  availableAt: now,
  expiresAt: new Date(now.getTime() + 30_000),
};

const createHarness = (
  allowed = true,
  source: CallSessionRecord | null = call,
) => {
  const cipher = createPushTokenCipher("test-call-alert-secret");
  const encrypted = cipher.encrypt("ExpoPushToken[test_call_alert_token]");
  const sent: PushProviderMessage[][] = [];
  let completed = false;
  const dependencies: CallAlertDeliveryDependencies = {
    calls: { findById: async () => source },
    cipher,
    devices: {
      register: async () => {
        throw new Error("not used");
      },
      disableInstallation: async () => undefined,
      disableById: async () => undefined,
      listEnabledForUser: async () => [
        {
          id: "507f1f77bcf86cd799439017",
          userId: call.recipientUserId,
          installationId: "89e46978-2270-438c-93e1-9c32506ea6ed",
          platform: PushPlatform.ANDROID,
          enabled: true,
          updatedAt: now.toISOString(),
          ...encrypted,
        },
      ],
    },
    logger: { warn: () => undefined },
    outbox: {
      enqueue: async () => undefined,
      listDispatchable: async () => [],
      claim: async () => null,
      markComplete: async () => {
        completed = true;
      },
      markQueued: async () => undefined,
      scheduleRetry: async () => undefined,
      markFailed: async () => undefined,
    },
    preferences: { allowsCallInterruption: async () => allowed },
    provider: {
      send: async (messages) => {
        sent.push([...messages]);
        return messages.map(() => ({ status: "OK" as const, ticketId: "ok" }));
      },
      receipts: async () => new Map(),
    },
    users: {
      findPublicById: async () => ({
        id: call.callerUserId,
        username: "caller",
        displayName: "Ramy",
        email: "caller@example.com",
        createdAt: now,
        updatedAt: now,
      }),
    },
    now: () => now,
  };
  return { completed: () => completed, dependencies, sent };
};

describe("call alert delivery", () => {
  test("sends a short-lived high-priority incoming call alert", async () => {
    const harness = createHarness();
    await deliverCallAlert(harness.dependencies, record);
    assert.equal(harness.completed(), true);
    assert.equal(harness.sent.length, 1);
    assert.deepEqual(harness.sent[0]?.[0], {
      token: "ExpoPushToken[test_call_alert_token]",
      title: "Ramy is calling",
      body: "Incoming InTouch video call",
      channelId: "intouch-calls-v1",
      sound: "intouch-call.wav",
      interruptionLevel: "time-sensitive",
      ttlSeconds: 30,
      collapseId: `call:${call.id}`,
      tag: `call:${call.id}`,
      data: {
        type: "CALL_INCOMING",
        callId: call.id,
        organizationId: call.organizationId,
        conversationId: call.conversationId,
        mediaMode: CallMediaMode.VIDEO,
        startedAt: now.toISOString(),
      },
    });
  });

  test("completes muted alerts without contacting Expo", async () => {
    const harness = createHarness(false);
    await deliverCallAlert(harness.dependencies, record);
    assert.equal(harness.completed(), true);
    assert.equal(harness.sent.length, 0);
  });

  test("drops a stale incoming alert after ringing ends", async () => {
    const harness = createHarness(true, { ...call, status: CallStatus.ENDED });
    await deliverCallAlert(harness.dependencies, record);
    assert.equal(harness.completed(), true);
    assert.equal(harness.sent.length, 0);
  });

  test("sends a data-only state update to dismiss stale ringing", async () => {
    const harness = createHarness(true, {
      ...call,
      status: CallStatus.ENDED,
    });
    await deliverCallAlert(harness.dependencies, {
      ...record,
      kind: CallAlertKind.STATE_CHANGED,
      expiresAt: new Date(now.getTime() + 5 * 60_000),
    });

    assert.deepEqual(harness.sent[0]?.[0], {
      token: "ExpoPushToken[test_call_alert_token]",
      title: "",
      body: "",
      sound: null,
      contentAvailable: true,
      ttlSeconds: 300,
      collapseId: `call:${call.id}`,
      tag: `call:${call.id}`,
      data: { type: "CALL_STATE_CHANGED", callId: call.id },
    });
  });

  test("declares uniqueness, claim, and expiry indexes", () => {
    const indexes = CallAlertOutboxModel.schema.indexes();
    assert.equal(
      indexes.some(([, options]) => options.name === "unique_call_alert"),
      true,
    );
    assert.equal(
      indexes.some(([, options]) => options.name === "claim_call_alert"),
      true,
    );
    assert.equal(
      indexes.some(
        ([, options]) =>
          options.name === "purge_call_alerts" &&
          options.expireAfterSeconds === 0,
      ),
      true,
    );
  });
});
