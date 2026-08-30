import assert from "node:assert/strict";
import { describe, test } from "node:test";
import pino from "pino";

import { AuthActionTokenModel } from "../src/modules/auth/auth.action-token.model.js";
import {
  createBrevoMailTransport,
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
  test("sends rendered mail through the Brevo HTTPS API", async () => {
    const requests: Array<{
      input: URL | Request | string;
      init?: RequestInit;
    }> = [];
    const fetchImplementation: typeof fetch = async (input, init) => {
      requests.push({ input, ...(init ? { init } : {}) });
      return new Response(JSON.stringify({ messageId: "brevo-message-id" }), {
        status: 201,
        headers: { "content-type": "application/json" },
      });
    };
    const transport = createBrevoMailTransport(
      {
        apiKey: "brevo-api-key",
        fromAddress: "noreply@example.com",
        fromName: "InTouch",
      },
      fetchImplementation,
    );

    const result = await transport.send({
      to: "ramy@example.com",
      subject: "Confirm your email",
      text: "Confirm your email",
      html: "<p>Confirm your email</p>",
    });

    assert.deepEqual(result, { messageId: "brevo-message-id" });
    assert.equal(requests[0]?.input, "https://api.brevo.com/v3/smtp/email");
    const headers = new Headers(requests[0]?.init?.headers);
    assert.equal(headers.get("api-key"), "brevo-api-key");
    const requestBody = requests[0]?.init?.body;
    if (typeof requestBody !== "string") {
      assert.fail("Brevo request body must be serialized JSON");
    }
    assert.deepEqual(JSON.parse(requestBody), {
      sender: { email: "noreply@example.com", name: "InTouch" },
      to: [{ email: "ramy@example.com" }],
      subject: "Confirm your email",
      htmlContent: "<p>Confirm your email</p>",
    });
  });

  test("maps Brevo HTTP failures to retry-safe provider codes", async () => {
    const transport = createBrevoMailTransport(
      {
        apiKey: "brevo-api-key",
        fromAddress: "noreply@example.com",
        fromName: "InTouch",
      },
      async () => new Response("unauthorized", { status: 401 }),
    );

    await assert.rejects(
      transport.send({
        to: "ramy@example.com",
        subject: "Confirm your email",
        text: "Confirm your email",
        html: "<p>Confirm your email</p>",
      }),
      (error: unknown) => {
        assert.equal(
          typeof error === "object" && error !== null && "code" in error
            ? error.code
            : undefined,
          "BREVO_HTTP_401",
        );
        return true;
      },
    );
  });

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
    const replacement = encrypted.ciphertext.endsWith("A") ? "B" : "A";
    assert.throws(() =>
      cipher.decrypt({
        ...encrypted,
        ciphertext: `${encrypted.ciphertext.slice(0, -1)}${replacement}`,
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
      claimById: async () => job,
      listDispatchable: async () => [job],
      markDispatched: async () => undefined,
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
    assert.ok(
      outboxIndexes.some(
        ([fields, options]) =>
          fields.status === 1 &&
          fields.availableAt === 1 &&
          fields.dispatchedAt === 1 &&
          options.name === "dispatch_pending_mail",
      ),
    );
    assert.ok(
      outboxIndexes.some(
        ([fields, options]) =>
          fields.status === 1 &&
          fields.availableAt === 1 &&
          fields.dispatchedAt === 1 &&
          options.name === "dispatch_pending_mail",
      ),
    );
  });
});
