import assert from "node:assert/strict";
import { describe, test } from "node:test";

import {
  forgotPasswordSchema,
  loginSchema,
  mobileAuthResponseSchema,
  mobileGoogleSchema,
  mobileLogoutSchema,
  mobileRefreshResponseSchema,
  refreshSchema,
  registerSchema,
  resendVerificationSchema,
  resetPasswordSchema,
  verifyEmailSchema,
} from "../auth/index.js";

describe("shared auth schemas", () => {
  test("normalizes a valid registration request", () => {
    const result = registerSchema.parse({
      username: "  ramy_47  ",
      displayName: "  Ramy Mohamed  ",
      email: "  RAMY@EXAMPLE.COM  ",
      password: "correct horse battery staple",
    });

    assert.deepEqual(result, {
      username: "ramy_47",
      displayName: "Ramy Mohamed",
      email: "ramy@example.com",
      password: "correct horse battery staple",
    });
  });

  test("rejects unknown registration fields", () => {
    const result = registerSchema.safeParse({
      username: "ramy_47",
      displayName: "Ramy Mohamed",
      email: "ramy@example.com",
      password: "correct horse battery staple",
      role: "admin",
    });

    assert.equal(result.success, false);
  });

  test("enforces bcrypt's 72-byte password limit", () => {
    const result = registerSchema.safeParse({
      username: "ramy_47",
      displayName: "Ramy Mohamed",
      email: "ramy@example.com",
      password: "é".repeat(37),
    });

    assert.equal(result.success, false);
  });

  test("derives login rules from registration email and password fields", () => {
    const result = loginSchema.parse({
      email: "  RAMY@EXAMPLE.COM ",
      password: "correct horse battery staple",
    });

    assert.equal(result.email, "ramy@example.com");
  });

  test("validates the normalized refresh cookie credential", () => {
    assert.deepEqual(refreshSchema.parse({ refreshToken: "session.secret" }), {
      refreshToken: "session.secret",
    });
  });

  test("normalizes strict email-action requests", () => {
    assert.deepEqual(
      forgotPasswordSchema.parse({ email: "  RAMY@EXAMPLE.COM " }),
      { email: "ramy@example.com" },
    );
    assert.deepEqual(
      resendVerificationSchema.parse({ email: " RAMY@EXAMPLE.COM " }),
      { email: "ramy@example.com" },
    );
    assert.equal(
      forgotPasswordSchema.safeParse({
        email: "ramy@example.com",
        accountExists: true,
      }).success,
      false,
    );
  });

  test("validates opaque action tokens and reset password limits", () => {
    const token = `${"a".repeat(24)}.${"b".repeat(43)}`;

    assert.deepEqual(verifyEmailSchema.parse({ token }), { token });
    assert.deepEqual(
      resetPasswordSchema.parse({
        token,
        password: "correct horse battery staple",
      }),
      { token, password: "correct horse battery staple" },
    );
    assert.equal(
      verifyEmailSchema.safeParse({ token: "invalid" }).success,
      false,
    );
    assert.equal(
      resetPasswordSchema.safeParse({ token, password: "é".repeat(37) })
        .success,
      false,
    );
  });

  test("keeps mobile credentials strict and separate from cookie responses", () => {
    assert.deepEqual(mobileGoogleSchema.parse({ idToken: "google-id-token" }), {
      idToken: "google-id-token",
    });
    assert.equal(
      mobileLogoutSchema.safeParse({
        refreshToken: "session.secret",
        extra: true,
      }).success,
      false,
    );
    assert.equal(
      mobileAuthResponseSchema.safeParse({
        user: {
          id: "507f1f77bcf86cd799439011",
          username: "ramy_47",
          displayName: "Ramy Mohamed",
          email: "ramy@example.com",
          avatarAssetId: null,
          createdAt: "2026-07-28T12:00:00.000Z",
          updatedAt: "2026-07-28T12:00:00.000Z",
        },
        accessToken: "access",
        refreshToken: "refresh",
      }).success,
      true,
    );
    assert.equal(
      mobileRefreshResponseSchema.safeParse({
        accessToken: "access",
        refreshToken: "refresh",
        cookie: "forbidden",
      }).success,
      false,
    );
  });
});
