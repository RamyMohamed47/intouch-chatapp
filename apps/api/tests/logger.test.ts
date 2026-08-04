import assert from "node:assert/strict";
import { describe, test } from "node:test";

import { createLoggerOptions, resolveLogLevel } from "../src/config/logger.js";

describe("logger config", () => {
  test("defaults to silent in test mode", () => {
    const level = resolveLogLevel({
      NODE_ENV: "test",
    });

    assert.equal(level, "silent");
  });

  test("respects an explicit LOG_LEVEL", () => {
    const level = resolveLogLevel({
      LOG_LEVEL: "debug",
      NODE_ENV: "test",
    });

    assert.equal(level, "debug");
  });

  test("throws for an invalid LOG_LEVEL", () => {
    assert.throws(
      () =>
        resolveLogLevel({
          LOG_LEVEL: "verbose",
        }),
      /LOG_LEVEL must be one of:/,
    );
  });

  test("uses pretty transport in development", () => {
    const options = createLoggerOptions({
      NODE_ENV: "development",
    });

    assert.equal(options.level, "info");
    assert.deepEqual(options.transport, {
      target: "pino-pretty",
      options: {
        colorize: true,
        ignore: "pid,hostname",
        translateTime: "SYS:standard",
      },
    });
  });
});
