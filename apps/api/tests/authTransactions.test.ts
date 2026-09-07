import assert from "node:assert/strict";
import { after, before, beforeEach, describe, test } from "node:test";

import { MongoMemoryReplSet } from "mongodb-memory-server";
import mongoose from "mongoose";

import { AuthSessionModel } from "../src/modules/auth/auth.model.js";
import createMongooseAuthSessionRepository from "../src/modules/auth/auth.repository.js";
import { createRefreshTokenManager } from "../src/modules/auth/auth.refresh-token.js";
import createAuthService from "../src/modules/auth/auth.service.js";
import { createAuthActionTokenManager } from "../src/modules/auth/auth.action-token.js";
import { createMongooseAuthActionTokenRepository } from "../src/modules/auth/auth.action-token.repository.js";
import { AuthActionTokenModel } from "../src/modules/auth/auth.action-token.model.js";
import type { LoginProtectionService } from "../src/modules/auth/auth.login-protection.js";
import type { AuthUnitOfWork } from "../src/modules/auth/auth.unit-of-work.js";
import type {
  AccessTokenManager,
  GoogleOAuthClient,
  PasswordHasher,
} from "../src/modules/auth/auth.types.js";
import { UserModel } from "../src/modules/user/user.model.js";
import createMongooseUserRepository from "../src/modules/user/user.repository.js";
import {
  MailOutboxModel,
  createMongooseMailOutboxRepository,
  type MailOutboxRepository,
} from "../src/modules/mail/index.js";
import { testMailFactory } from "./unitOfWorkContext.js";

let replicaSet: MongoMemoryReplSet;

before(async () => {
  replicaSet = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
  await mongoose.connect(replicaSet.getUri("intouch-auth-transactions"));
  await Promise.all([
    UserModel.syncIndexes(),
    AuthSessionModel.syncIndexes(),
    AuthActionTokenModel.syncIndexes(),
    MailOutboxModel.syncIndexes(),
  ]);
});

beforeEach(async () => {
  await Promise.all([
    UserModel.deleteMany({}).exec(),
    AuthSessionModel.deleteMany({}).exec(),
    AuthActionTokenModel.deleteMany({}).exec(),
    MailOutboxModel.deleteMany({}).exec(),
  ]);
});

after(async () => {
  await mongoose.disconnect();
  await replicaSet.stop();
});

const passwords: PasswordHasher = {
  hash: async (password) => `hashed:${password}`,
  compare: async () => true,
  compareDummy: async () => false,
};
const loginProtection: LoginProtectionService = {
  reserveAttempt: async () => undefined,
  clearAttempts: async () => undefined,
};
const accessTokens: AccessTokenManager = {
  sign: async (userId) => `access:${userId}`,
  verify: async () => ({ userId: "unused" }),
};
const googleOAuth: GoogleOAuthClient = {
  getAuthorizationUrl: () => "https://accounts.google.test",
  exchangeCode: async () => {
    throw new Error("unused");
  },
  verifyIdToken: async () => {
    throw new Error("unused");
  },
};

describe("authentication transactions", () => {
  test("refreshes the Google avatar fallback without replacing a custom avatar", async () => {
    const repository = createMongooseUserRepository();
    const firstUsedAt = new Date("2026-09-01T10:00:00.000Z");
    const nextUsedAt = new Date("2026-09-02T10:00:00.000Z");
    const user = await repository.createGoogleUser({
      username: "google_avatar_user",
      displayName: "Google Avatar User",
      email: "google-avatar@example.com",
      avatarUrl: "https://example.com/old-avatar.png",
      providerAccountId: "google-avatar-account",
      usedAt: firstUsedAt,
    });
    const avatarAssetId = new mongoose.Types.ObjectId();
    await UserModel.updateOne(
      { _id: user.id },
      { $set: { avatarAssetId } },
    ).exec();

    const refreshed = await repository.useGoogleProvider(
      "google-avatar-account",
      nextUsedAt,
      "https://example.com/new-avatar.png",
    );
    const preserved = await repository.useGoogleProvider(
      "google-avatar-account",
      new Date("2026-09-03T10:00:00.000Z"),
    );

    assert.equal(refreshed?.avatarUrl, "https://example.com/new-avatar.png");
    assert.equal(refreshed?.avatarAssetId, avatarAssetId.toString());
    assert.equal(preserved?.avatarUrl, "https://example.com/new-avatar.png");
    assert.equal(preserved?.avatarAssetId, avatarAssetId.toString());
  });

  test("stores the Google avatar fallback when linking an existing account", async () => {
    const repository = createMongooseUserRepository();
    const linkedAt = new Date("2026-09-02T10:00:00.000Z");
    const user = await repository.createPasswordUser({
      username: "linked_avatar_user",
      displayName: "Linked Avatar User",
      email: "linked-avatar@example.com",
      passwordHash: "hashed:password",
    });

    const linked = await repository.linkGoogleProvider(
      user.id,
      "linked-google-account",
      linkedAt,
      "https://example.com/linked-avatar.png",
    );

    assert.equal(linked?.avatarUrl, "https://example.com/linked-avatar.png");
  });

  test("rolls back registration when outbox creation fails", async () => {
    const unitOfWork: AuthUnitOfWork = {
      run: (work) =>
        mongoose.connection.transaction((session) => {
          const outbox = createMongooseMailOutboxRepository(session);
          const failingOutbox: MailOutboxRepository = {
            ...outbox,
            enqueue: async () => {
              throw new Error("forced outbox failure");
            },
          };
          return work({
            actionTokens: createMongooseAuthActionTokenRepository(session),
            mailOutbox: failingOutbox,
            sessions: createMongooseAuthSessionRepository(session),
            users: createMongooseUserRepository(session),
          });
        }),
    };
    const service = createAuthService({
      accessTokens,
      googleOAuth,
      loginProtection,
      passwords,
      refreshTokens: createRefreshTokenManager(),
      sessions: createMongooseAuthSessionRepository(),
      unitOfWork,
      users: createMongooseUserRepository(),
      actionTokens: createAuthActionTokenManager(
        "test-auth-action-token-secret-that-is-long-enough",
      ),
      mail: testMailFactory,
      mailProtection: { reserve: async () => undefined },
    });

    await assert.rejects(
      service.register({
        username: "transaction_user",
        displayName: "Transaction User",
        email: "transaction@example.com",
        password: "correct horse battery staple",
      }),
      /forced outbox failure/,
    );
    assert.equal(await UserModel.countDocuments(), 0);
    assert.equal(await AuthSessionModel.countDocuments(), 0);
  });
});
