import assert from "node:assert/strict";
import { describe, test } from "node:test";

import {
  EmailVerificationRequiredError,
  InvalidOrExpiredAuthTokenError,
  InvalidRefreshTokenError,
} from "../src/modules/auth/auth.errors.js";
import type { AuthSessionRepository } from "../src/modules/auth/auth.repository.js";
import createAuthService from "../src/modules/auth/auth.service.js";
import type { LoginProtectionService } from "../src/modules/auth/auth.login-protection.js";
import type { AuthUnitOfWork } from "../src/modules/auth/auth.unit-of-work.js";
import { createRefreshTokenManager } from "../src/modules/auth/auth.refresh-token.js";
import { createAuthActionTokenManager } from "../src/modules/auth/auth.action-token.js";
import { AuthActionPurpose } from "../src/modules/auth/auth.action-token.model.js";
import type { AuthActionTokenRepository } from "../src/modules/auth/auth.action-token.repository.js";
import type { MailOutboxRepository } from "../src/modules/mail/index.js";
import type {
  AccessTokenManager,
  GoogleIdentity,
  GoogleOAuthClient,
  PasswordHasher,
} from "../src/modules/auth/auth.types.js";
import type {
  CreateGoogleUserInput,
  CreatePasswordUserInput,
  AuthUserRepository,
} from "../src/modules/user/user.repository.js";
import { UserIdentityConflictError } from "../src/modules/user/user.errors.js";
import {
  EmailVerificationStatus,
  type PasswordUser,
  type PublicUser,
} from "../src/modules/user/user.types.js";
import { testMailFactory } from "./unitOfWorkContext.js";

const now = new Date("2026-07-28T12:00:00.000Z");
const user: PublicUser = {
  id: "507f1f77bcf86cd799439011",
  username: "ramy_47",
  displayName: "Ramy Mohamed",
  email: "ramy@example.com",
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
  const reservedLoginEmails: string[] = [];
  const clearedLoginEmails: string[] = [];
  const reservedMailActions: string[] = [];
  const dummyComparisons: string[] = [];
  const verifiedUserIds: string[] = [];
  const passwordUpdates: Array<{ userId: string; passwordHash: string }> = [];
  let linkedGoogleProvider:
    { providerAccountId: string; usedAt: Date; userId: string } | undefined;
  const existingUsernames = new Set<string>();
  const sessionRecords = new Map<string, SessionRecord>();
  const users: AuthUserRepository = {
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
    findAuthAccountByEmail: async () => {
      const accountUser = passwordUser?.user ?? emailUser;
      return accountUser
        ? {
            user: accountUser,
            hasPassword: passwordUser !== null,
            emailVerificationStatus:
              passwordUser?.emailVerificationStatus ??
              EmailVerificationStatus.VERIFIED,
          }
        : null;
    },
    findVerifiedPublicByEmail: async () => emailUser,
    findPublicByEmail: async () => emailUser,
    findPublicById: async (userId) => (userId === user.id ? user : null),
    findPublicByIds: async () => [user],
    findLastSeenByIds: async () => [],
    linkGoogleProvider: async (userId, providerAccountId, usedAt) => {
      linkedGoogleProvider = { userId, providerAccountId, usedAt };
      return linkGoogleResult;
    },
    touchPasswordProvider: async () => {},
    useGoogleProvider: async () =>
      googleProviderResults?.shift() ?? googleProviderUser,
    usernameExists: async (username) => existingUsernames.has(username),
    updateLastSeen: async () => undefined,
    markEmailVerified: async (userId) => {
      verifiedUserIds.push(userId);
      return userId === user.id;
    },
    updatePasswordAndVerify: async (userId, passwordHash) => {
      passwordUpdates.push({ userId, passwordHash });
      return userId === user.id ? user : null;
    },
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
    deleteByUserId: async (userId) => {
      for (const [sessionId, record] of sessionRecords) {
        if (record.userId === userId) sessionRecords.delete(sessionId);
      }
    },
  };
  const actionTokenRecords = new Map<
    string,
    {
      id: string;
      userId: string;
      purpose: (typeof AuthActionPurpose)[keyof typeof AuthActionPurpose];
      secretHash: string;
      expiresAt: Date;
    }
  >();
  const actionTokenRepository: AuthActionTokenRepository = {
    replace: async (input) => {
      actionTokenRecords.set(`${input.userId}:${input.purpose}`, input);
    },
    consume: async (input) => {
      const entry = [...actionTokenRecords.entries()].find(
        ([, record]) =>
          record.id === input.id &&
          record.purpose === input.purpose &&
          record.secretHash === input.secretHash &&
          record.expiresAt > input.now,
      );
      if (!entry) return null;
      actionTokenRecords.delete(entry[0]);
      return entry[1].userId;
    },
    deleteForUser: async (userId, purpose) => {
      actionTokenRecords.delete(`${userId}:${purpose}`);
    },
  };
  const mailJobs: string[] = [];
  const cancelledMailJobs: string[] = [];
  const mailOutbox: MailOutboxRepository = {
    enqueue: async (input) => {
      mailJobs.push(input.aggregateKey);
    },
    cancel: async (aggregateKey) => {
      cancelledMailJobs.push(aggregateKey);
    },
    cancelByPrefix: async () => undefined,
    claimNext: async () => null,
    claimById: async () => null,
    listDispatchable: async () => [],
    markDispatched: async () => undefined,
    markSent: async () => undefined,
    scheduleRetry: async () => undefined,
    markFailed: async () => undefined,
  };
  const passwords: PasswordHasher = {
    hash: async (password) => `hashed:${password}`,
    compare: async (password, hash) => hash === `hashed:${password}`,
    compareDummy: async (password) => {
      dummyComparisons.push(password);
      return false;
    },
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
  const actionTokens = createAuthActionTokenManager(
    "test-auth-action-token-secret-that-is-long-enough",
  );
  const mailTokens: Array<{ kind: "RESET" | "VERIFY"; token: string }> = [];
  const mail = {
    ...testMailFactory,
    verification: (
      input: Parameters<typeof testMailFactory.verification>[0],
    ) => {
      mailTokens.push({ kind: "VERIFY" as const, token: input.token });
      return testMailFactory.verification(input);
    },
    passwordReset: (
      input: Parameters<typeof testMailFactory.passwordReset>[0],
    ) => {
      mailTokens.push({ kind: "RESET" as const, token: input.token });
      return testMailFactory.passwordReset(input);
    },
  };
  const unitOfWork: AuthUnitOfWork = {
    run: (work) =>
      work({
        sessions,
        users,
        actionTokens: actionTokenRepository,
        mailOutbox,
      }),
  };
  const loginProtection: LoginProtectionService = {
    reserveAttempt: async (email) => {
      reservedLoginEmails.push(email);
    },
    clearAttempts: async (email) => {
      clearedLoginEmails.push(email);
    },
  };
  const service = createAuthService({
    users,
    sessions,
    passwords,
    accessTokens,
    googleOAuth,
    loginProtection,
    refreshTokens,
    unitOfWork,
    actionTokens,
    mail,
    mailProtection: {
      reserve: async (email, purpose) => {
        reservedMailActions.push(`${purpose}:${email}`);
      },
    },
    now: () => now,
    usernameSuffix: () => "deadbeef",
  });

  return {
    service,
    clearedLoginEmails,
    dummyComparisons,
    reservedLoginEmails,
    sessionRecords,
    mailJobs,
    mailTokens,
    cancelledMailJobs,
    passwordUpdates,
    reservedMailActions,
    verifiedUserIds,
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
    assert.deepEqual(harness.clearedLoginEmails, ["new.user@example.com"]);
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

  test("registers a pending password user and queues verification", async () => {
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
    assert.deepEqual(result, {
      email: user.email,
      verificationRequired: true,
    });
    assert.equal(harness.sessionRecords.size, 0);
    assert.deepEqual(harness.mailJobs, [`auth-verification:${user.id}`]);
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
      emailVerificationStatus: EmailVerificationStatus.VERIFIED,
    });

    await assert.rejects(
      harness.service.login({
        email: user.email,
        password: "correct horse battery staple",
      }),
      { statusCode: 401, message: "Invalid email or password" },
    );
    assert.deepEqual(harness.reservedLoginEmails, [user.email]);
    assert.deepEqual(harness.clearedLoginEmails, []);
  });

  test("rejects a correct password until the account email is verified", async () => {
    const harness = createHarness();
    harness.setPasswordUser({
      user,
      passwordHash: "hashed:correct horse battery staple",
      emailVerificationStatus: EmailVerificationStatus.PENDING,
    });

    await assert.rejects(
      harness.service.login({
        email: user.email,
        password: "correct horse battery staple",
      }),
      EmailVerificationRequiredError,
    );
    assert.equal(harness.sessionRecords.size, 0);
    assert.deepEqual(harness.clearedLoginEmails, [user.email]);
  });

  test("verifies an email with a single-use action token", async () => {
    const harness = createHarness();
    await harness.service.register({
      username: user.username,
      displayName: user.displayName,
      email: user.email,
      password: "correct horse battery staple",
    });
    const token = harness.mailTokens.find(
      (mail) => mail.kind === "VERIFY",
    )?.token;
    assert.ok(token);

    await harness.service.verifyEmail({ token });

    assert.deepEqual(harness.verifiedUserIds, [user.id]);
    assert.deepEqual(harness.cancelledMailJobs, [
      `auth-verification:${user.id}`,
    ]);
    await assert.rejects(
      harness.service.verifyEmail({ token }),
      InvalidOrExpiredAuthTokenError,
    );
  });

  test("keeps password reset requests generic for unknown accounts", async () => {
    const harness = createHarness();

    await harness.service.forgotPassword({ email: user.email });

    assert.deepEqual(harness.reservedMailActions, [
      `PASSWORD_RESET:${user.email}`,
    ]);
    assert.deepEqual(harness.mailJobs, []);
  });

  test("resets the password once and revokes every refresh session", async () => {
    const harness = createHarness();
    harness.setPasswordUser({
      user,
      passwordHash: "hashed:old password",
      emailVerificationStatus: EmailVerificationStatus.PENDING,
    });
    harness.sessionRecords.set("session-a", {
      userId: user.id,
      tokenHash: "hash-a",
      expiresAt: new Date(now.getTime() + 60_000),
    });

    await harness.service.forgotPassword({ email: user.email });
    const token = harness.mailTokens.find(
      (mail) => mail.kind === "RESET",
    )?.token;
    assert.ok(token);
    await harness.service.resetPassword({
      token,
      password: "new correct horse battery staple",
    });

    assert.deepEqual(harness.passwordUpdates, [
      {
        userId: user.id,
        passwordHash: "hashed:new correct horse battery staple",
      },
    ]);
    assert.equal(harness.sessionRecords.size, 0);
    assert.deepEqual(harness.clearedLoginEmails, [user.email]);
    await assert.rejects(
      harness.service.resetPassword({
        token,
        password: "another correct horse battery staple",
      }),
      InvalidOrExpiredAuthTokenError,
    );
  });

  test("performs dummy password work for an unknown account", async () => {
    const harness = createHarness();
    const password = "correct horse battery staple";

    await assert.rejects(
      harness.service.login({ email: user.email, password }),
      { statusCode: 401, message: "Invalid email or password" },
    );

    assert.deepEqual(harness.dummyComparisons, [password]);
    assert.deepEqual(harness.clearedLoginEmails, []);
  });

  test("allows independent sessions across successful logins", async () => {
    const harness = createHarness();
    harness.setPasswordUser({
      user,
      passwordHash: "hashed:correct horse battery staple",
      emailVerificationStatus: EmailVerificationStatus.VERIFIED,
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
    assert.deepEqual(harness.reservedLoginEmails, [user.email, user.email]);
    assert.deepEqual(harness.clearedLoginEmails, [user.email, user.email]);
  });

  test("rotates refresh tokens and revokes the session on replay", async () => {
    const harness = createHarness();
    harness.setPasswordUser({
      user,
      passwordHash: "hashed:correct horse battery staple",
      emailVerificationStatus: EmailVerificationStatus.VERIFIED,
    });
    const authenticated = await harness.service.login({
      email: user.email,
      password: "correct horse battery staple",
    });
    const refreshed = await harness.service.refresh(authenticated.refreshToken);

    assert.notEqual(refreshed.refreshToken, authenticated.refreshToken);
    assert.equal(refreshed.accessToken, `access:${user.id}`);
    await assert.rejects(
      harness.service.refresh(authenticated.refreshToken),
      InvalidRefreshTokenError,
    );
    await assert.rejects(
      harness.service.refresh(refreshed.refreshToken),
      InvalidRefreshTokenError,
    );
    assert.equal(harness.sessionRecords.size, 0);
  });

  test("revokes the current session and ignores invalid logout tokens", async () => {
    const harness = createHarness();
    harness.setPasswordUser({
      user,
      passwordHash: "hashed:correct horse battery staple",
      emailVerificationStatus: EmailVerificationStatus.VERIFIED,
    });
    const authenticated = await harness.service.login({
      email: user.email,
      password: "correct horse battery staple",
    });

    await harness.service.logout(authenticated.refreshToken);
    await harness.service.logout("invalid-token");
    await harness.service.logout(undefined);

    assert.equal(harness.sessionRecords.size, 0);
  });
});
