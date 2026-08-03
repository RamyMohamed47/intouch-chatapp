import assert from "node:assert/strict";
import { describe, test } from "node:test";

import { InvalidRefreshTokenError } from "../src/modules/auth/auth.errors.js";
import type { AuthSessionRepository } from "../src/modules/auth/auth.repository.js";
import createAuthService from "../src/modules/auth/auth.service.js";
import { createRefreshTokenManager } from "../src/modules/auth/auth.refresh-token.js";
import type {
  AccessTokenManager,
  GoogleIdentity,
  GoogleOAuthClient,
  PasswordHasher,
} from "../src/modules/auth/auth.types.js";
import type {
  CreateGoogleUserInput,
  CreatePasswordUserInput,
  UserRepository,
} from "../src/modules/user/user.repository.js";
import { UserIdentityConflictError } from "../src/modules/user/user.errors.js";
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
  let createError: Error | undefined;
  let createdGoogleInput: CreateGoogleUserInput | undefined;
  let createGoogleError: Error | undefined;
  let emailUser: PublicUser | null = null;
  let googleIdentity: GoogleIdentity = {
    providerAccountId: "google-account-id",
    email: user.email,
    displayName: user.displayName,
    avatarUrl: "https://example.com/avatar.png",
  };
  let googleProviderUser: PublicUser | null = null;
  let googleProviderResults: Array<PublicUser | null> | undefined;
  let linkGoogleResult: PublicUser | null = user;
  let linkedGoogleProvider:
    { providerAccountId: string; usedAt: Date; userId: string } | undefined;
  const existingUsernames = new Set<string>();
  const sessionRecords = new Map<string, SessionRecord>();
  const users: UserRepository = {
    hasIdentityConflict: async () => conflict,
    createPasswordUser: async (input) => {
      if (createError) {
        throw createError;
      }

      createdInput = input;
      return user;
    },
    createGoogleUser: async (input) => {
      if (createGoogleError) {
        throw createGoogleError;
      }

      createdGoogleInput = input;
      return user;
    },
    findPasswordUserByEmail: async () => passwordUser,
    findPublicByEmail: async () => emailUser,
    findPublicById: async (userId) => (userId === user.id ? user : null),
    findPublicByIds: async () => [user],
    linkGoogleProvider: async (userId, providerAccountId, usedAt) => {
      linkedGoogleProvider = { userId, providerAccountId, usedAt };
      return linkGoogleResult;
    },
    touchPasswordProvider: async () => {},
    useGoogleProvider: async () =>
      googleProviderResults?.shift() ?? googleProviderUser,
    usernameExists: async (username) => existingUsernames.has(username),
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
  const googleOAuth: GoogleOAuthClient = {
    getAuthorizationUrl: (state) =>
      `https://accounts.google.test?state=${state}`,
    exchangeCode: async () => googleIdentity,
  };
  const refreshTokens = createRefreshTokenManager();
  const service = createAuthService({
    users,
    sessions,
    passwords,
    accessTokens,
    googleOAuth,
    refreshTokens,
    now: () => now,
    usernameSuffix: () => "deadbeef",
  });

  return {
    service,
    sessionRecords,
    getCreatedInput: () => createdInput,
    getCreatedGoogleInput: () => createdGoogleInput,
    getLinkedGoogleProvider: () => linkedGoogleProvider,
    setEmailUser: (value: PublicUser | null) => {
      emailUser = value;
    },
    setConflict: (value: boolean) => {
      conflict = value;
    },
    setCreateError: (error: Error | undefined) => {
      createError = error;
    },
    setGoogleIdentity: (value: GoogleIdentity) => {
      googleIdentity = value;
    },
    setCreateGoogleError: (error: Error | undefined) => {
      createGoogleError = error;
    },
    setGoogleProviderUser: (value: PublicUser | null) => {
      googleProviderUser = value;
    },
    setGoogleProviderResults: (values: Array<PublicUser | null>) => {
      googleProviderResults = values;
    },
    setLinkGoogleResult: (value: PublicUser | null) => {
      linkGoogleResult = value;
    },
    setPasswordUser: (value: PasswordUser | null) => {
      passwordUser = value;
    },
    setUsernameExists: (username: string) => {
      existingUsernames.add(username);
    },
  };
};

describe("authService", () => {
  test("creates a Google user and refresh session without an access token", async () => {
    const harness = createHarness();
    harness.setGoogleIdentity({
      providerAccountId: "google-new-user",
      email: "new.user@example.com",
      displayName: "New User",
      avatarUrl: "https://example.com/new-user.png",
    });

    const result = await harness.service.loginWithGoogle("authorization-code");

    assert.deepEqual(harness.getCreatedGoogleInput(), {
      username: "new_user",
      displayName: "New User",
      email: "new.user@example.com",
      avatarUrl: "https://example.com/new-user.png",
      providerAccountId: "google-new-user",
      usedAt: now,
    });
    assert.match(result.refreshToken, /^[^.]+\.[^.]+$/);
    assert.equal(harness.sessionRecords.size, 1);
  });

  test("links Google to an existing account with the same email", async () => {
    const harness = createHarness();
    harness.setEmailUser(user);

    await harness.service.loginWithGoogle("authorization-code");

    assert.deepEqual(harness.getLinkedGoogleProvider(), {
      userId: user.id,
      providerAccountId: "google-account-id",
      usedAt: now,
    });
    assert.equal(harness.getCreatedGoogleInput(), undefined);
  });

  test("reuses an existing Google provider without overwriting the profile", async () => {
    const harness = createHarness();
    harness.setGoogleProviderUser(user);

    await harness.service.loginWithGoogle("authorization-code");

    assert.equal(harness.getLinkedGoogleProvider(), undefined);
    assert.equal(harness.getCreatedGoogleInput(), undefined);
  });

  test("adds a collision-safe suffix to generated Google usernames", async () => {
    const harness = createHarness();
    harness.setUsernameExists("ramy");

    await harness.service.loginWithGoogle("authorization-code");

    assert.equal(harness.getCreatedGoogleInput()?.username, "ramy_deadbeef");
  });

  test("rejects linking a different Google identity", async () => {
    const harness = createHarness();
    harness.setEmailUser(user);
    harness.setLinkGoogleResult(null);

    await assert.rejects(
      harness.service.loginWithGoogle("authorization-code"),
      { statusCode: 409, message: "Google account cannot be linked" },
    );
  });

  test("recovers when a concurrent request creates the Google user", async () => {
    const harness = createHarness();
    harness.setCreateGoogleError(new UserIdentityConflictError());
    harness.setGoogleProviderResults([null, user]);

    const result = await harness.service.loginWithGoogle("authorization-code");

    assert.match(result.refreshToken, /^[^.]+\.[^.]+$/);
    assert.equal(harness.sessionRecords.size, 1);
  });

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

  test("maps repository conflict errors caused by concurrent registration", async () => {
    const harness = createHarness();
    harness.setCreateError(new UserIdentityConflictError());

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
