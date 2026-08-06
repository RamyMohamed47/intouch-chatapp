import assert from "node:assert/strict";
import { describe, test } from "node:test";

import { LoginAttemptModel } from "../src/modules/auth/auth.login-attempt.model.js";
import type {
  LoginAttemptRepository,
  LoginAttemptReservation,
  ReserveLoginAttemptInput,
} from "../src/modules/auth/auth.login-attempt.repository.js";
import createLoginProtectionService, {
  createLoginIdentifierHash,
} from "../src/modules/auth/auth.login-protection.js";

const secret = "a-login-throttle-secret-that-is-over-32-bytes";
const now = new Date("2026-08-06T12:00:00.000Z");

describe("login protection", () => {
  test("normalizes identifiers before creating stable HMAC keys", () => {
    const normalized = createLoginIdentifierHash("user@example.com", secret);

    assert.equal(
      createLoginIdentifierHash("  User@Example.COM ", secret),
      normalized,
    );
    assert.notEqual(
      createLoginIdentifierHash("another@example.com", secret),
      normalized,
    );
    assert.doesNotMatch(normalized, /user|example/i);
  });

  test("reserves with the configured policy and clears the same key", async () => {
    let reserved: ReserveLoginAttemptInput | undefined;
    let clearedHash: string | undefined;
    const attempts: LoginAttemptRepository = {
      reserve: async (input) => {
        reserved = input;
        return { allowed: true, attemptCount: 1 };
      },
      clear: async (identifierHash) => {
        clearedHash = identifierHash;
      },
    };
    const service = createLoginProtectionService({
      attempts,
      policy: {
        attemptLimit: 10,
        windowMs: 900_000,
        cooldownMs: 900_000,
        hashSecret: secret,
      },
      now: () => now,
    });

    await service.reserveAttempt("User@Example.com");
    await service.clearAttempts("user@example.com");

    assert.deepEqual(reserved, {
      identifierHash: createLoginIdentifierHash("user@example.com", secret),
      limit: 10,
      windowMs: 900_000,
      cooldownMs: 900_000,
      now,
    });
    assert.equal(clearedHash, reserved?.identifierHash);
  });

  test("reports throttling without exposing the email", async () => {
    const blockedUntil = new Date(now.getTime() + 900_000);
    const reservation: LoginAttemptReservation = {
      allowed: false,
      attemptCount: 10,
      blockedUntil,
    };
    const observed: Array<{
      identifierHash: string;
      attemptCount: number;
      blockedUntil?: Date;
    }> = [];
    const service = createLoginProtectionService({
      attempts: {
        reserve: async () => reservation,
        clear: async () => undefined,
      },
      policy: {
        attemptLimit: 10,
        windowMs: 900_000,
        cooldownMs: 900_000,
        hashSecret: secret,
      },
      now: () => now,
      observer: {
        throttled: (details) => observed.push(details),
      },
    });

    await assert.rejects(service.reserveAttempt("user@example.com"), {
      statusCode: 429,
      code: "TOO_MANY_REQUESTS",
      message: "Too many login attempts. Try again later.",
    });
    assert.equal(observed.length, 1);
    assert.equal(observed[0]?.attemptCount, 10);
    assert.equal(observed[0]?.blockedUntil, blockedUntil);
    assert.doesNotMatch(JSON.stringify(observed), /user@example\.com/i);
  });

  test("declares unique identifier and TTL indexes", () => {
    const indexes = LoginAttemptModel.schema.indexes();
    const identifierIndex = indexes.find(
      ([, options]) => options.name === "unique_login_attempt_identifier",
    );
    const expiryIndex = indexes.find(
      ([, options]) => options.name === "expire_login_attempts",
    );

    assert.equal(identifierIndex?.[1].unique, true);
    assert.equal(expiryIndex?.[1].expireAfterSeconds, 0);
  });
});
