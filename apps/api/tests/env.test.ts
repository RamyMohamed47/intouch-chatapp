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
  VOICE_PROVIDER: "livekit",
  LIVEKIT_URL: "wss://intouch-test.livekit.cloud",
  LIVEKIT_API_KEY: "livekit-api-key",
  LIVEKIT_API_SECRET: "a-livekit-api-secret-that-is-over-32-bytes",
  REDIS_URL: "redis://redis.internal:6379",
  RUNTIME_STATE_PROVIDER: "redis",
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
    assert.deepEqual(config.storage, { provider: "disabled" });
    assert.equal(config.uploadDailyUserBytes, 524_288_000);
    assert.equal(config.organizationStorageBytes, 5_368_709_120);
    assert.deepEqual(config.observability, { provider: "disabled" });
    assert.deepEqual(config.voice, {
      provider: "livekit",
      url: "wss://intouch-test.livekit.cloud",
      apiKey: "livekit-api-key",
      apiSecret: "a-livekit-api-secret-that-is-over-32-bytes",
    });
    assert.equal(config.trustProxy, "loopback");
    assert.equal(config.mailTransport.provider, "smtp");
    assert.equal(config.backgroundJobsProvider, "bullmq");
    assert.deepEqual(config.runtimeState, {
      provider: "redis",
      keyPrefix: "intouch:development:v2",
      url: "redis://redis.internal:6379",
    });
  });

  test("defaults to memory runtime state outside production", () => {
    const config = loadConfig({
      ...validEnv,
      REDIS_URL: undefined,
      RUNTIME_STATE_PROVIDER: undefined,
    });

    assert.deepEqual(config.runtimeState, {
      provider: "memory",
      keyPrefix: "intouch:development:v2",
    });
    assert.equal(config.backgroundJobsProvider, "polling");
  });

  test("defaults voice to disabled locally and validates LiveKit settings", () => {
    assert.deepEqual(
      loadConfig({
        ...validEnv,
        VOICE_PROVIDER: undefined,
        LIVEKIT_URL: undefined,
        LIVEKIT_API_KEY: undefined,
        LIVEKIT_API_SECRET: undefined,
      }).voice,
      { provider: "disabled" },
    );
    assert.throws(
      () => loadConfig({ ...validEnv, LIVEKIT_URL: "https://livekit.test" }),
      /must use wss/,
    );
    assert.throws(
      () => loadConfig({ ...validEnv, LIVEKIT_API_SECRET: "too-short" }),
      /at least 32 bytes/,
    );
  });

  test("validates the background job provider against runtime state", () => {
    assert.throws(
      () =>
        loadConfig({
          ...validEnv,
          BACKGROUND_JOBS_PROVIDER: "bullmq",
          REDIS_URL: undefined,
          RUNTIME_STATE_PROVIDER: "memory",
        }),
      /requires RUNTIME_STATE_PROVIDER=redis/,
    );
    assert.throws(
      () =>
        loadConfig({ ...validEnv, BACKGROUND_JOBS_PROVIDER: "unsupported" }),
      /must be bullmq or polling/,
    );
    assert.equal(
      loadConfig({ ...validEnv, BACKGROUND_JOBS_PROVIDER: "polling" })
        .backgroundJobsProvider,
      "polling",
    );
  });

  test("requires Redis runtime state in production", () => {
    const productionEnv = {
      ...validEnv,
      NODE_ENV: "production",
      GOOGLE_OAUTH_CALLBACK_URL:
        "https://app.example.com/api/v1/auth/oauth/google/callback",
      STORAGE_PROVIDER: "r2",
      R2_ACCOUNT_ID: "account-id",
      R2_ACCESS_KEY_ID: "access-key-id",
      R2_SECRET_ACCESS_KEY: "secret-access-key",
      R2_BUCKET_NAME: "intouch-private",
    };

    assert.throws(
      () =>
        loadConfig({
          ...productionEnv,
          RUNTIME_STATE_PROVIDER: undefined,
        }),
      /RUNTIME_STATE_PROVIDER env var is required in production/,
    );
    assert.throws(
      () =>
        loadConfig({
          ...productionEnv,
          RUNTIME_STATE_PROVIDER: "memory",
        }),
      /RUNTIME_STATE_PROVIDER must be redis in production/,
    );
  });

  test("validates Redis URLs and key prefixes", () => {
    assert.throws(
      () => loadConfig({ ...validEnv, REDIS_URL: "https://redis.test" }),
      /REDIS_URL must use/,
    );
    assert.throws(
      () => loadConfig({ ...validEnv, REDIS_KEY_PREFIX: "invalid prefix" }),
      /REDIS_KEY_PREFIX/,
    );
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
      STORAGE_PROVIDER: "r2",
      R2_ACCOUNT_ID: "account-id",
      R2_ACCESS_KEY_ID: "access-key-id",
      R2_SECRET_ACCESS_KEY: "secret-access-key",
      R2_BUCKET_NAME: "intouch-private",
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
    assert.equal(config.storage.provider, "r2");
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

  test("requires complete R2 configuration in production", () => {
    const productionEnv = {
      ...validEnv,
      NODE_ENV: "production",
      SEARCH_PROVIDER: "atlas",
      GOOGLE_OAUTH_CALLBACK_URL:
        "https://app.example.com/api/v1/auth/oauth/google/callback",
    };

    assert.throws(
      () => loadConfig(productionEnv),
      /STORAGE_PROVIDER env var is required in production/,
    );
    assert.throws(
      () => loadConfig({ ...productionEnv, STORAGE_PROVIDER: "disabled" }),
      /STORAGE_PROVIDER must be r2 in production/,
    );
    assert.throws(
      () => loadConfig({ ...productionEnv, STORAGE_PROVIDER: "r2" }),
      /R2_ACCOUNT_ID env var is required/,
    );
  });

  test("accepts configurable upload quotas and rejects invalid bounds", () => {
    const config = loadConfig({
      ...validEnv,
      UPLOAD_DAILY_USER_BYTES: "1048576",
      ORGANIZATION_STORAGE_BYTES: "2097152",
    });

    assert.equal(config.uploadDailyUserBytes, 1_048_576);
    assert.equal(config.organizationStorageBytes, 2_097_152);
    assert.throws(() =>
      loadConfig({ ...validEnv, UPLOAD_DAILY_USER_BYTES: "0" }),
    );
    assert.throws(() =>
      loadConfig({ ...validEnv, ORGANIZATION_STORAGE_BYTES: "1.5" }),
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

  test("validates optional OTLP observability configuration", () => {
    const config = loadConfig({
      ...validEnv,
      OBSERVABILITY_PROVIDER: "otlp",
      OTEL_EXPORTER_OTLP_ENDPOINT: "http://127.0.0.1:4318",
      OTEL_SERVICE_NAME: "intouch-api-test",
      OTEL_TRACES_SAMPLER_ARG: "0.25",
    });

    assert.deepEqual(config.observability, {
      provider: "otlp",
      endpoint: "http://127.0.0.1:4318",
      sampleRatio: 0.25,
      serviceName: "intouch-api-test",
    });
    assert.throws(
      () =>
        loadConfig({
          ...validEnv,
          OBSERVABILITY_PROVIDER: "otlp",
          OTEL_EXPORTER_OTLP_ENDPOINT: undefined,
        }),
      /OTEL_EXPORTER_OTLP_ENDPOINT is required/,
    );
    assert.throws(() =>
      loadConfig({
        ...validEnv,
        OTEL_EXPORTER_OTLP_ENDPOINT: "http://127.0.0.1:4318",
      }),
    );
    assert.throws(() =>
      loadConfig({
        ...validEnv,
        OBSERVABILITY_PROVIDER: "otlp",
        OTEL_EXPORTER_OTLP_ENDPOINT: "http://127.0.0.1:4318",
        OTEL_TRACES_SAMPLER_ARG: "1.1",
      }),
    );
  });

  test("requires secure authenticated OTLP export in production", () => {
    const productionEnv = {
      ...validEnv,
      NODE_ENV: "production",
      GOOGLE_OAUTH_CALLBACK_URL:
        "https://app.example.com/api/v1/auth/oauth/google/callback",
      OBSERVABILITY_PROVIDER: "otlp",
      OTEL_EXPORTER_OTLP_ENDPOINT: "https://otlp.example.com",
      SEARCH_PROVIDER: "atlas",
      STORAGE_PROVIDER: "r2",
      R2_ACCOUNT_ID: "account-id",
      R2_ACCESS_KEY_ID: "access-key-id",
      R2_SECRET_ACCESS_KEY: "secret-access-key",
      R2_BUCKET_NAME: "intouch-private",
    };

    assert.throws(() => loadConfig(productionEnv), /OTLP_HEADERS is required/);
    assert.throws(
      () =>
        loadConfig({
          ...productionEnv,
          OTEL_EXPORTER_OTLP_ENDPOINT: "http://otlp.example.com",
          OTEL_EXPORTER_OTLP_HEADERS: "Authorization=Basic token",
        }),
      /must use HTTPS in production/,
    );
    assert.equal(
      loadConfig({
        ...productionEnv,
        OTEL_EXPORTER_OTLP_HEADERS: "Authorization=Basic token",
      }).observability.provider,
      "otlp",
    );
  });
});
