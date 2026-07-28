import assert from "node:assert/strict";
import { describe, test } from "node:test";

import { InvalidRefreshTokenError } from "../src/modules/auth/auth.errors.js";
import type { AuthSessionRepository } from "../src/modules/auth/auth.repository.js";
import createAuthService from "../src/modules/auth/auth.service.js";
import { createRefreshTokenManager } from "../src/modules/auth/auth.tokens.js";
import type {
  AccessTokenManager,
  PasswordHasher,
} from "../src/modules/auth/auth.types.js";
import type {
  CreatePasswordUserInput,
  UserRepository,
} from "../src/modules/user/user.repository.js";
import {
  UserStatus,
  type PasswordUser,
  type PublicUser,
} from "../src/modules/user/user.types.js";

const now = new Date("2026-07-28T12:00:00.000Z");
const user: PublicUser = {
  id: "507f1f77bcf86cd799439011",
  username: "ramy_47",
  displayName: "Ramy Mohamed",
  email: "ramy@example.com",
  status: UserStatus.OFFLINE,
  createdAt: now,
  updatedAt: now,
};

interface SessionRecord {
  userId: string;
  tokenHash: string;
  expiresAt: Date;
}

const createHarness = () => {
  let passwordUser: PasswordUser | null = null;
  let conflict = false;
  let createdInput: CreatePasswordUserInput | undefined;
  const sessionRecords = new Map<string, SessionRecord>();
  const users: UserRepository = {
    hasIdentityConflict: async () => conflict,
    createPasswordUser: async (input) => {
      createdInput = input;
      return user;
    },
    findPasswordUserByEmail: async () => passwordUser,
    findPublicById: async (userId) => (userId === user.id ? user : null),
    touchPasswordProvider: async () => {},
  };
  const sessions: AuthSessionRepository = {
    create: async (input) => {
      sessionRecords.set(input.id, {
        userId: input.userId,
        tokenHash: input.tokenHash,
        expiresAt: input.expiresAt,
      });
    },
    rotate: async (input) => {
      const record = sessionRecords.get(input.id);

      if (
        !record ||
        record.tokenHash !== input.currentTokenHash ||
        record.expiresAt <= input.now
      ) {
        sessionRecords.delete(input.id);
        return null;
      }

      record.tokenHash = input.nextTokenHash;
      return record.userId;
    },
    deleteById: async (sessionId) => {
      sessionRecords.delete(sessionId);
    },
  };
  const passwords: PasswordHasher = {
    hash: async (password) => `hashed:${password}`,
    compare: async (password, hash) => hash === `hashed:${password}`,
  };
  const accessTokens: AccessTokenManager = {
    sign: async (userId) => `access:${userId}`,
    verify: async () => ({ userId: user.id }),
  };
  const refreshTokens = createRefreshTokenManager();
  const service = createAuthService({
    users,
    sessions,
    passwords,
    accessTokens,
    refreshTokens,
    now: () => now,
  });

  return {
    service,
    sessionRecords,
    getCreatedInput: () => createdInput,
    setConflict: (value: boolean) => {
      conflict = value;
    },
    setPasswordUser: (value: PasswordUser | null) => {
      passwordUser = value;
    },
  };
};

describe("authService", () => {
  test("registers a password user and creates a 30-day session", async () => {
    const harness = createHarness();
    const result = await harness.service.register({
      username: user.username,
      displayName: user.displayName,
      email: user.email,
      password: "correct horse battery staple",
    });

    assert.deepEqual(harness.getCreatedInput(), {
      username: user.username,
      displayName: user.displayName,
      email: user.email,
      passwordHash: "hashed:correct horse battery staple",
    });
    assert.equal(result.user, user);
    assert.equal(result.accessToken, `access:${user.id}`);
    assert.equal(harness.sessionRecords.size, 1);
    const session = [...harness.sessionRecords.values()][0];
    assert.equal(session?.expiresAt.toISOString(), "2026-08-27T12:00:00.000Z");
  });

  test("rejects duplicate registration identities", async () => {
    const harness = createHarness();
    harness.setConflict(true);

    await assert.rejects(
      harness.service.register({
        username: user.username,
        displayName: user.displayName,
        email: user.email,
        password: "correct horse battery staple",
      }),
      { statusCode: 409 },
    );
  });

  test("returns one generic failure for incorrect login credentials", async () => {
    const harness = createHarness();
    harness.setPasswordUser({
      user,
      passwordHash: "hashed:different password",
    });

    await assert.rejects(
      harness.service.login({
        email: user.email,
        password: "correct horse battery staple",
      }),
      { statusCode: 401, message: "Invalid email or password" },
    );
  });

  test("allows independent sessions across successful logins", async () => {
    const harness = createHarness();
    harness.setPasswordUser({
      user,
      passwordHash: "hashed:correct horse battery staple",
    });

    await harness.service.login({
      email: user.email,
      password: "correct horse battery staple",
    });
    await harness.service.login({
      email: user.email,
      password: "correct horse battery staple",
    });

    assert.equal(harness.sessionRecords.size, 2);
  });

  test("rotates refresh tokens and revokes the session on replay", async () => {
    const harness = createHarness();
    const registered = await harness.service.register({
      username: user.username,
      displayName: user.displayName,
      email: user.email,
      password: "correct horse battery staple",
    });
    const refreshed = await harness.service.refresh(registered.refreshToken);

    assert.notEqual(refreshed.refreshToken, registered.refreshToken);
    assert.equal(refreshed.accessToken, `access:${user.id}`);
    await assert.rejects(
      harness.service.refresh(registered.refreshToken),
      InvalidRefreshTokenError,
    );
    await assert.rejects(
      harness.service.refresh(refreshed.refreshToken),
      InvalidRefreshTokenError,
    );
    assert.equal(harness.sessionRecords.size, 0);
  });
});
