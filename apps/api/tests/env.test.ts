import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { fileURLToPath } from "node:url";

import { getEnvFilePath, loadConfig } from "../src/config/env.js";

const validEnv: NodeJS.ProcessEnv = {
  ACCESS_TOKEN_SECRET: "a-development-secret-that-is-over-32-bytes",
  CLIENT_ORIGINS: "https://app.example.com,http://localhost:5173/",
  DATABASE: "mongodb://example.test/<db_password>",
  DB_PASSWORD: "password",
  GOOGLE_OAUTH_CALLBACK_URL:
    "http://localhost:5173/api/v1/auth/oauth/google/callback",
  GOOGLE_OAUTH_CLIENT_ID: "google-client-id",
  GOOGLE_OAUTH_CLIENT_SECRET: "google-client-secret",
  GOOGLE_OAUTH_FRONTEND_REDIRECT_URL: "https://app.example.com/auth/callback",
  LOGIN_THROTTLE_SECRET: "a-login-throttle-secret-that-is-over-32-bytes",
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
    assert.equal(config.trustProxy, "loopback");
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
      () => loadConfig({ ...validEnv, NODE_ENV: "production" }),
      /must use HTTPS in production/,
    );
  });
});
