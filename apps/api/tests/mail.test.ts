import assert from "node:assert/strict";
import { describe, test } from "node:test";
import pino from "pino";

import { AuthActionTokenModel } from "../src/modules/auth/auth.action-token.model.js";
import {
  createMailOutboxJobFactory,
  createMailOutboxWorker,
  createMailPayloadCipher,
  createMailRenderer,
  MailKind,
  MailOutboxModel,
  type MailOutboxRecord,
  type MailOutboxRepository,
} from "../src/modules/mail/index.js";

const now = new Date("2026-08-29T12:00:00.000Z");
const cipher = createMailPayloadCipher(
  "test-mail-encryption-secret-that-is-at-least-32-bytes",
);

describe("transactional mail", () => {
  test("encrypts sensitive payloads and rejects tampering", () => {
    const payload = {
      kind: MailKind.PASSWORD_RESET,
      to: "ramy@example.com",
      displayName: "Ramy Mohamed",
      token: "token.secret",
    } as const;
    const encrypted = cipher.encrypt(payload);

    assert.deepEqual(cipher.decrypt(encrypted), payload);
    assert.equal(encrypted.ciphertext.includes(payload.token), false);
    assert.throws(() =>
      cipher.decrypt({
        ...encrypted,
        ciphertext: `${encrypted.ciphertext.slice(0, -1)}A`,
      }),
    );
  });

  test("builds branded fragment-token mail without leaking HTML input", () => {
    const factory = createMailOutboxJobFactory(cipher, () => now);
    const reset = factory.passwordReset({
      userId: "507f1f77bcf86cd799439011",
      email: "ramy@example.com",
      displayName: "<Ramy>",
      token: "token.secret",
      expiresAt: new Date(now.getTime() + 15 * 60 * 1000),
    });
    const rendered = createMailRenderer("https://app.example.com")(
      cipher.decrypt(reset),
    );

    assert.match(rendered.html, /reset-password#token=token\.secret/);
    assert.doesNotMatch(rendered.html, /reset-password\?token=/);
    assert.match(rendered.html, /&lt;Ramy&gt;/);
    assert.doesNotMatch(rendered.html, /<Ramy>/);
  });

  test("retries transient delivery failures without logging recipients", async () => {
    const payload = cipher.encrypt({
      kind: MailKind.EMAIL_VERIFICATION,
      to: "ramy@example.com",
      displayName: "Ramy",
      token: "token.secret",
    });
    const job: MailOutboxRecord = {
      id: "507f1f77bcf86cd799439099",
      aggregateKey: "auth-verification:507f1f77bcf86cd799439011",
      kind: MailKind.EMAIL_VERIFICATION,
      ...payload,
      attempts: 1,
      availableAt: now,
      expiresAt: new Date(now.getTime() + 24 * 60 * 60 * 1000),
    };
    let retryAt: Date | undefined;
    let retryCode: string | undefined;
    const outbox: MailOutboxRepository = {
      enqueue: async () => undefined,
      cancel: async () => undefined,
      cancelByPrefix: async () => undefined,
      claimNext: async () => job,
      markSent: async () => assert.fail("failed mail must not be marked sent"),
      scheduleRetry: async (_id, availableAt, errorCode) => {
        retryAt = availableAt;
        retryCode = errorCode;
      },
      markFailed: async () => assert.fail("first failure should be retried"),
    };
    const worker = createMailOutboxWorker({
      cipher,
      logger: pino({ level: "silent" }),
      outbox,
      render: createMailRenderer("https://app.example.com"),
      transport: {
        send: async () => {
          throw Object.assign(new Error("provider unavailable"), {
            code: "ETIMEDOUT",
          });
        },
        close: () => undefined,
      },
      now: () => now,
    });

    await worker.runOnce();

    assert.equal(retryAt?.toISOString(), "2026-08-29T12:00:30.000Z");
    assert.equal(retryCode, "ETIMEDOUT");
  });

  test("declares action-token and outbox uniqueness and expiry indexes", () => {
    const actionIndexes = AuthActionTokenModel.schema.indexes();
    const outboxIndexes = MailOutboxModel.schema.indexes();

    assert.ok(
      actionIndexes.some(
        ([fields, options]) =>
          fields.userId === 1 &&
          fields.purpose === 1 &&
          options.unique === true,
      ),
    );
    assert.ok(
      actionIndexes.some(
        ([fields, options]) =>
          fields.expiresAt === 1 && options.expireAfterSeconds === 0,
      ),
    );
    assert.ok(
      outboxIndexes.some(
        ([fields, options]) =>
          fields.aggregateKey === 1 && options.unique === true,
      ),
    );
    assert.ok(
      outboxIndexes.some(
        ([fields, options]) =>
          fields.purgeAt === 1 && options.expireAfterSeconds === 0,
      ),
    );
  });
});
