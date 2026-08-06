import assert from "node:assert/strict";
import { after, before, beforeEach, describe, test } from "node:test";

import { MongoMemoryServer } from "mongodb-memory-server";
import mongoose from "mongoose";

import { LoginAttemptModel } from "../src/modules/auth/auth.login-attempt.model.js";
import createMongooseLoginAttemptRepository from "../src/modules/auth/auth.login-attempt.repository.js";

let mongo: MongoMemoryServer;

before(async () => {
  mongo = await MongoMemoryServer.create();
  await mongoose.connect(mongo.getUri("intouch-login-attempts"));
  await LoginAttemptModel.syncIndexes();
});

beforeEach(async () => {
  await LoginAttemptModel.deleteMany({}).exec();
});

after(async () => {
  await mongoose.disconnect();
  await mongo.stop();
});

const identifierHash = "a".repeat(64);
const startedAt = new Date("2026-08-06T12:00:00.000Z");
const windowMs = 15 * 60 * 1000;
const cooldownMs = 15 * 60 * 1000;
const limit = 10;

const reserve = (
  repository: ReturnType<typeof createMongooseLoginAttemptRepository>,
  now = startedAt,
) =>
  repository.reserve({
    identifierHash,
    limit,
    windowMs,
    cooldownMs,
    now,
  });

describe("login attempt repository", () => {
  test("admits ten attempts and blocks the eleventh without extending cooldown", async () => {
    const repository = createMongooseLoginAttemptRepository();

    for (let attempt = 1; attempt <= limit; attempt += 1) {
      const reservation = await reserve(repository);
      assert.equal(reservation.allowed, true);
      assert.equal(reservation.attemptCount, attempt);
    }

    const blocked = await reserve(
      repository,
      new Date(startedAt.getTime() + 1),
    );
    assert.equal(blocked.allowed, false);
    assert.equal(blocked.attemptCount, limit);
    const originalBlockedUntil = blocked.blockedUntil;

    const repeated = await reserve(
      repository,
      new Date(startedAt.getTime() + 60_000),
    );
    assert.equal(repeated.allowed, false);
    assert.equal(
      repeated.blockedUntil?.getTime(),
      originalBlockedUntil?.getTime(),
    );
  });

  test("resets an expired cooldown even before TTL cleanup", async () => {
    const repository = createMongooseLoginAttemptRepository();

    for (let attempt = 0; attempt < limit; attempt += 1) {
      await reserve(repository);
    }

    const afterCooldown = await reserve(
      repository,
      new Date(startedAt.getTime() + cooldownMs),
    );

    assert.deepEqual(afterCooldown, { allowed: true, attemptCount: 1 });
  });

  test("enforces the account limit under concurrent reservations", async () => {
    const repository = createMongooseLoginAttemptRepository();
    const reservations = await Promise.all(
      Array.from({ length: 12 }, () => reserve(repository)),
    );

    assert.equal(
      reservations.filter((reservation) => reservation.allowed).length,
      limit,
    );
    assert.equal(
      reservations.filter((reservation) => !reservation.allowed).length,
      2,
    );
    assert.equal(
      (await LoginAttemptModel.findOne({ identifierHash }).lean().exec())
        ?.attemptCount,
      limit,
    );
  });

  test("clears the account attempt state", async () => {
    const repository = createMongooseLoginAttemptRepository();
    await reserve(repository);

    await repository.clear(identifierHash);

    assert.equal(await LoginAttemptModel.countDocuments(), 0);
  });
});
