import assert from "node:assert/strict";
import { describe, test } from "node:test";

import { loadConfig } from "../src/config/env.js";

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
};

describe("auth environment configuration", () => {
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
