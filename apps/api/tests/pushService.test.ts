import assert from "node:assert/strict";
import { describe, test } from "node:test";

import { NotificationType } from "@intouch/shared/notifications";

import { createPushTokenCipher } from "../src/modules/push/push.crypto.js";
import { createPushDeviceService } from "../src/modules/push/push-device.service.js";
import { deliverPush } from "../src/modules/push/push.delivery.js";
import type { PushDeviceRepository } from "../src/modules/push/push-device.repository.js";
import type { PushOutboxRepository } from "../src/modules/push/push-outbox.repository.js";
import type {
  PushProviderMessage,
  PushOutboxRecord,
} from "../src/modules/push/push.types.js";

const now = new Date("2026-09-08T12:00:00.000Z");
const secret = "push-token-secret-that-is-long-enough-for-tests";
const token = "ExponentPushToken[abcdefghijklmnopqrstuv]";

const outboxRepository = (
  markDispatched: PushOutboxRepository["markDispatched"],
): PushOutboxRepository => ({
  enqueue: async () => undefined,
  listDispatchable: async () => [],
  listReceiptReady: async () => [],
  claimDispatch: async () => null,
  claimReceipt: async () => null,
  markDispatched,
  markQueued: async () => undefined,
  scheduleDispatchRetry: async () => undefined,
  scheduleReceiptRetry: async () => undefined,
  markComplete: async () => undefined,
  markFailed: async () => undefined,
});

describe("push delivery", () => {
  test("encrypts tokens at rest and returns only safe device metadata", async () => {
    const cipher = createPushTokenCipher(secret);
    const encrypted = cipher.encrypt(token);
    assert.notEqual(encrypted.ciphertext, token);
    assert.equal(cipher.decrypt(encrypted), token);
    assert.equal(cipher.hash(token), cipher.hash(token));

    let persistedCiphertext = "";
    const devices: PushDeviceRepository = {
      register: async (input) => {
        persistedCiphertext = input.ciphertext;
        return {
          id: "507f1f77bcf86cd799439011",
          userId: input.userId,
          installationId: input.installationId,
          platform: input.platform,
          enabled: true,
          ciphertext: input.ciphertext,
          iv: input.iv,
          authTag: input.authTag,
          updatedAt: now.toISOString(),
        };
      },
      disableInstallation: async () => undefined,
      disableById: async () => undefined,
      listEnabledForUser: async () => [],
    };
    const service = createPushDeviceService({
      cipher,
      devices,
      now: () => now,
    });
    const result = await service.register(
      "507f1ff86cd799439012",
      "6caea54e-3f3a-4bb2-a620-f43ee8e08a98",
      { expoPushToken: token, platform: "ANDROID" },
    );
    assert.notEqual(persistedCiphertext, token);
    assert.equal("expoPushToken" in result, false);
    assert.equal(result.enabled, true);
  });

  test("sends metadata-only copy and invalidates unregistered devices", async () => {
    const cipher = createPushTokenCipher(secret);
    const encrypted = cipher.encrypt(token);
    const invalidated: string[] = [];
    const sent: PushProviderMessage[] = [];
    let dispatched = false;
    const devices: PushDeviceRepository = {
      register: async () => {
        throw new Error("Unused");
      },
      disableInstallation: async () => undefined,
      disableById: async (id) => {
        invalidated.push(id);
      },
      listEnabledForUser: async () => [
        {
          id: "507f1f77bcf86cd799439011",
          userId: "507f1f77bcf86cd799439012",
          installationId: "6caea54e-3f3a-4bb2-a620-f43ee8e08a98",
          platform: "ANDROID",
          enabled: true,
          ...encrypted,
          updatedAt: now.toISOString(),
        },
      ],
    };
    const record: PushOutboxRecord = {
      id: "507f1ff86cd799",
      notificationId: "507f1f77bcf86cd799439013",
      recipientUserId: "507f1ff86cd799439012",
      pushVersion: 1,
      attempts: 1,
      receiptAttempts: 0,
      availableAt: now,
      expiresAt: new Date(now.getTime() + 60_000),
      tickets: [],
    };
    await deliverPush(
      {
        cipher,
        devices,
        logger: { warn() {} },
        notifications: {
          findForPush: async () => ({
            recipientUserId: record.recipientUserId,
            unreadCount: 1,
            notification: {
              id: record.notificationId,
              type: NotificationType.DIRECT_MESSAGE_RECEIVED,
              actor: {
                id: "507f1f77bcf86cd799439014",
                username: "alex",
                displayName: "Alex Rivera",
                avatarAssetId: null,
              },
              organization: {
                id: "507f1f77bcf86cd799439015",
                name: "Northstar",
                logoAssetId: null,
              },
              conversationId: "507f1f77bcf86cd799439016",
              latestMessageId: "507f1f77bcf86cd799439017",
              messageCount: 1,
              readAt: null,
              createdAt: now.toISOString(),
              lastActivityAt: now.toISOString(),
            },
          }),
        },
        outbox: outboxRepository(async () => {
          dispatched = true;
        }),
        provider: {
          send: async (messages) => {
            sent.push(...messages);
            return [{ status: "ERROR", errorCode: "DeviceNotRegistered" }];
          },
          receipts: async () => new Map(),
        },
        now: () => now,
      },
      record,
    );
    assert.equal(sent.length, 1);
    assert.equal(sent[0]?.token, token);
    assert.equal(sent[0]?.body.includes("hello"), false);
    assert.deepEqual(invalidated, ["507f1f77bcf86cd799439011"]);
    assert.equal(dispatched, true);
  });
});
