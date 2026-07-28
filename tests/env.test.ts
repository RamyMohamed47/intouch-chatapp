import assert from "node:assert/strict";
import { describe, test } from "node:test";

import { loadConfig } from "../src/config/env.js";

const validEnv: NodeJS.ProcessEnv = {
  ACCESS_TOKEN_SECRET: "a-development-secret-that-is-over-32-bytes",
  CLIENT_ORIGINS: "https://app.example.com,http://localhost:5173/",
  DATABASE: "mongodb://example.test/<db_password>",
  DB_PASSWORD: "password",
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
  });

  test("uses a secure-prefixed cookie in production", () => {
    const config = loadConfig({ ...validEnv, NODE_ENV: "production" });

    assert.equal(config.cookieName, "__Secure-intouch_refresh");
    assert.equal(config.cookieSecure, true);
    assert.equal(config.trustProxy, 1);
  });

  test("rejects short access-token secrets", () => {
    assert.throws(
      () => loadConfig({ ...validEnv, ACCESS_TOKEN_SECRET: "too-short" }),
      /at least 32 bytes/,
    );
  });
});
