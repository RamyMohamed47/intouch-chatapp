import assert from "node:assert/strict";
import { describe, test } from "node:test";
import pino from "pino";

import {
  createBullMqBackgroundJobsRuntime,
  createPollingBackgroundJobsRuntime,
  type BackgroundJobComponent,
} from "../src/infrastructure/background-jobs/index.js";
import { parseMailJobData } from "../src/modules/mail/index.js";
import { parseAssetCleanupJobData } from "../src/modules/uploads/index.js";

describe("background jobs", () => {
  test("accepts only strict opaque BullMQ payloads", () => {
    assert.deepEqual(parseMailJobData({ kind: "RECONCILE" }), {
      kind: "RECONCILE",
    });
    assert.deepEqual(
      parseMailJobData({
        kind: "DELIVER",
        outboxId: "507f1f77bcf86cd799439011",
      }),
      { kind: "DELIVER", outboxId: "507f1f77bcf86cd799439011" },
    );
    assert.deepEqual(
      parseAssetCleanupJobData({
        kind: "CLEANUP",
        assetId: "507f1f77bcf86cd799439012",
        mode: "DELETE",
        cleanupAttempt: 2,
      }),
      {
        kind: "CLEANUP",
        assetId: "507f1f77bcf86cd799439012",
        mode: "DELETE",
        cleanupAttempt: 2,
      },
    );
    assert.throws(() =>
      parseMailJobData({
        kind: "DELIVER",
        outboxId: "not-an-id",
        recipient: "private@example.com",
      }),
    );
    assert.throws(() =>
      parseAssetCleanupJobData({
        kind: "CLEANUP",
        assetId: "507f1f77bcf86cd799439012",
        mode: "DELETE",
        cleanupAttempt: 0,
        objectKey: "must-not-enter-redis",
      }),
    );
  });

  test("starts, reports, and closes polling components", async () => {
    const calls: string[] = [];
    const runtime = createPollingBackgroundJobsRuntime([
      {
        start: () => calls.push("start"),
        close: async () => {
          calls.push("close");
        },
      },
    ]);

    assert.equal(runtime.provider, "polling");
    assert.equal(runtime.isReady(), true);
    await runtime.start();
    await runtime.close();
    assert.deepEqual(calls, ["start", "close"]);
  });

  test("closes BullMQ components when startup fails", async () => {
    const calls: string[] = [];
    const component = (
      name: string,
      fail: boolean,
    ): BackgroundJobComponent => ({
      isReady: () => false,
      async start() {
        calls.push(`start:${name}`);
        if (fail) throw new Error("queue unavailable");
      },
      async close() {
        calls.push(`close:${name}`);
      },
    });
    const runtime = createBullMqBackgroundJobsRuntime(
      [component("mail", true), component("assets", false)],
      pino({ level: "silent" }),
    );

    await assert.rejects(runtime.start(), /queue unavailable/);
    assert.ok(calls.includes("close:mail"));
    assert.ok(calls.includes("close:assets"));
  });
});
