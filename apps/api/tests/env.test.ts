import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { fileURLToPath } from "node:url";

import { getEnvFilePath, loadConfig } from "../src/config/env.js";

const validEnv: NodeJS.ProcessEnv = {
  ACCESS_TOKEN_SECRET: "a-development-secret-that-is-over-32-bytes",
  AUTH_ACTION_TOKEN_SECRET: "an-auth-action-secret-that-is-over-32-bytes",
  CLIENT_ORIGINS: "https://app.example.com,http://localhost:5173/",
  DATABASE: "mongodb://example.test/<db_password>",
  DB_PASSWORD: "password",
  GOOGLE_OAUTH_CALLBACK_URL:
    "http://localhost:5173/api/v1/auth/oauth/google/callback",
  GOOGLE_OAUTH_CLIENT_ID: "google-client-id",
  GOOGLE_OAUTH_CLIENT_SECRET: "google-client-secret",
  GOOGLE_OAUTH_FRONTEND_REDIRECT_URL: "https://app.example.com/auth/callback",
  LOGIN_THROTTLE_SECRET: "a-login-throttle-secret-that-is-over-32-bytes",
  MAIL_FROM_ADDRESS: "noreply@example.com",
  MAIL_FROM_NAME: "InTouch",
  MAIL_OUTBOX_ENCRYPTION_SECRET:
    "a-mail-outbox-encryption-secret-over-32-bytes",
  MAIL_PROVIDER: "smtp",
  SEARCH_PROVIDER: "native",
  SMTP_HOST: "smtp.example.com",
  SMTP_PASSWORD: "smtp-password",
  SMTP_REQUIRE_TLS: "true",
  SMTP_SECURE: "false",
  SMTP_USER: "smtp-user",
  WEB_APP_URL: "https://app.example.com",
};

describe("auth environment configuration", () => {
  test("resolves config.env from the API package instead of the working directory", () => {
    assert.equal(
      getEnvFilePath(),
      fileURLToPath(new URL("../config.env", import.meta.url)),
    );
  });

  test("normalizes client origins and development cookie settings", () => {
    const config = loadConfig(validEnv);

    assert.deepEqual(config.clientOrigins, [
      "https://app.example.com",
      "http://localhost:5173",
    ]);
    assert.equal(config.cookieName, "intouch_refresh");
    assert.equal(config.cookieSecure, false);
    assert.equal(
      config.googleOAuthStateCookieName,
      "intouch_google_oauth_state",
    );
    assert.equal(config.loginAttemptLimit, 10);
    assert.equal(config.loginAttemptWindowMs, 900_000);
    assert.equal(config.loginAttemptCooldownMs, 900_000);
    assert.equal(config.searchProvider, "native");
    assert.equal(config.trustProxy, "loopback");
    assert.equal(config.mailTransport.provider, "smtp");
  });

  test("accepts bounded login-attempt configuration", () => {
    const config = loadConfig({
      ...validEnv,
      LOGIN_ATTEMPT_LIMIT: "5",
      LOGIN_ATTEMPT_WINDOW_MS: "60000",
      LOGIN_ATTEMPT_COOLDOWN_MS: "120000",
    });

    assert.equal(config.loginAttemptLimit, 5);
    assert.equal(config.loginAttemptWindowMs, 60_000);
    assert.equal(config.loginAttemptCooldownMs, 120_000);
  });

  test("uses a secure-prefixed cookie in production", () => {
    const config = loadConfig({
      ...validEnv,
      NODE_ENV: "production",
      SEARCH_PROVIDER: "atlas",
      GOOGLE_OAUTH_CALLBACK_URL:
        "https://app.example.com/api/v1/auth/oauth/google/callback",
    });

    assert.equal(config.cookieName, "__Secure-intouch_refresh");
    assert.equal(config.cookieSecure, true);
    assert.equal(
      config.googleOAuthStateCookieName,
      "__Secure-intouch_google_oauth_state",
    );
    assert.equal(config.trustProxy, 1);
  });

  test("rejects short access-token secrets", () => {
    assert.throws(
      () => loadConfig({ ...validEnv, ACCESS_TOKEN_SECRET: "too-short" }),
      /at least 32 bytes/,
    );
  });

  test("rejects missing or short login-throttle secrets", () => {
    assert.throws(
      () => loadConfig({ ...validEnv, LOGIN_THROTTLE_SECRET: "too-short" }),
      /LOGIN_THROTTLE_SECRET must be at least 32 bytes/,
    );
    assert.throws(
      () => loadConfig({ ...validEnv, LOGIN_THROTTLE_SECRET: undefined }),
      /LOGIN_THROTTLE_SECRET env var is required/,
    );
  });

  test("rejects invalid login-attempt bounds", () => {
    for (const invalidEnv of [
      { LOGIN_ATTEMPT_LIMIT: "0" },
      { LOGIN_ATTEMPT_LIMIT: "101" },
      { LOGIN_ATTEMPT_WINDOW_MS: "1.5" },
      { LOGIN_ATTEMPT_WINDOW_MS: "86400001" },
      { LOGIN_ATTEMPT_COOLDOWN_MS: "-1" },
    ]) {
      assert.throws(() => loadConfig({ ...validEnv, ...invalidEnv }));
    }
  });

  test("requires Google OAuth URLs to use allowlisted origins", () => {
    assert.throws(
      () =>
        loadConfig({
          ...validEnv,
          GOOGLE_OAUTH_CALLBACK_URL:
            "https://attacker.example/api/v1/auth/oauth/google/callback",
        }),
      /origin must be included in CLIENT_ORIGINS/,
    );
  });

  test("requires HTTPS Google OAuth URLs in production", () => {
    assert.throws(
      () =>
        loadConfig({
          ...validEnv,
          NODE_ENV: "production",
          SEARCH_PROVIDER: "atlas",
        }),
      /must use HTTPS in production/,
    );
  });

  test("requires an explicit valid search provider in production", () => {
    assert.throws(
      () =>
        loadConfig({
          ...validEnv,
          NODE_ENV: "production",
          SEARCH_PROVIDER: undefined,
          GOOGLE_OAUTH_CALLBACK_URL:
            "https://app.example.com/api/v1/auth/oauth/google/callback",
        }),
      /SEARCH_PROVIDER env var is required/,
    );
    assert.throws(
      () => loadConfig({ ...validEnv, SEARCH_PROVIDER: "invalid" }),
      /SEARCH_PROVIDER must be atlas or native/,
    );
  });

  test("rejects insecure SMTP transport in production", () => {
    assert.throws(
      () =>
        loadConfig({
          ...validEnv,
          NODE_ENV: "production",
          SEARCH_PROVIDER: "atlas",
          GOOGLE_OAUTH_CALLBACK_URL:
            "https://app.example.com/api/v1/auth/oauth/google/callback",
          SMTP_REQUIRE_TLS: "false",
          SMTP_SECURE: "false",
        }),
      /SMTP transport must require TLS in production/,
    );
  });

  test("configures Brevo without requiring SMTP credentials", () => {
    const config = loadConfig({
      ...validEnv,
      MAIL_PROVIDER: "brevo",
      BREVO_API_KEY: "brevo-api-key",
      SMTP_HOST: undefined,
      SMTP_PASSWORD: undefined,
      SMTP_USER: undefined,
    });

    assert.deepEqual(config.mailTransport, {
      provider: "brevo",
      apiKey: "brevo-api-key",
    });
  });

  test("requires only the selected mail provider credentials", () => {
    assert.throws(
      () =>
        loadConfig({
          ...validEnv,
          MAIL_PROVIDER: "brevo",
          BREVO_API_KEY: undefined,
        }),
      /BREVO_API_KEY env var is required/,
    );
    assert.throws(
      () => loadConfig({ ...validEnv, MAIL_PROVIDER: "unsupported" }),
      /MAIL_PROVIDER must be brevo or smtp/,
    );
  });

  test("requires an explicit mail provider in production", () => {
    assert.throws(
      () =>
        loadConfig({
          ...validEnv,
          NODE_ENV: "production",
          MAIL_PROVIDER: undefined,
          SEARCH_PROVIDER: "atlas",
          GOOGLE_OAUTH_CALLBACK_URL:
            "https://app.example.com/api/v1/auth/oauth/google/callback",
        }),
      /MAIL_PROVIDER env var is required in production/,
    );
  });
});
