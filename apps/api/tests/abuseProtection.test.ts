import assert from "node:assert/strict";
import { describe, test } from "node:test";

import {
  createInMemoryRateLimitStore,
  createInMemorySocketConnectionStore,
  createRateLimitService,
  createSocketConnectionService,
  RateLimitAction,
  type TokenBucketPolicy,
} from "../src/modules/abuse-protection/index.js";

const policies = (policy: TokenBucketPolicy) =>
  Object.fromEntries(
    Object.values(RateLimitAction).map((action) => [action, policy]),
  ) as Record<RateLimitAction, TokenBucketPolicy>;

describe("authenticated abuse protection", () => {
  test("allows bursts, refills tokens, and reports one limit transition", async () => {
    let now = new Date("2026-08-06T00:00:00.000Z");
    const events: string[] = [];
    const store = createInMemoryRateLimitStore();
    const service = createRateLimitService({
      now: () => now,
      onLimited: ({ action }) => events.push(action),
      policies: policies({ capacity: 2, refillIntervalMs: 1_000 }),
      store,
    });

    assert.equal(
      (await service.consume("user-one", RateLimitAction.MESSAGE_CREATE))
        .allowed,
      true,
    );
    assert.equal(
      (await service.consume("user-one", RateLimitAction.MESSAGE_CREATE))
        .allowed,
      true,
    );
    const firstDenied = await service.consume(
      "user-one",
      RateLimitAction.MESSAGE_CREATE,
    );
    const repeatedDenied = await service.consume(
      "user-one",
      RateLimitAction.MESSAGE_CREATE,
    );
    assert.equal(firstDenied.allowed, false);
    assert.equal(firstDenied.retryAfterMs, 1_000);
    assert.equal(repeatedDenied.allowed, false);
    assert.deepEqual(events, [RateLimitAction.MESSAGE_CREATE]);

    now = new Date(now.getTime() + 1_000);
    assert.equal(
      (await service.consume("user-one", RateLimitAction.MESSAGE_CREATE))
        .allowed,
      true,
    );
    assert.equal(
      (await service.consume("user-two", RateLimitAction.MESSAGE_CREATE))
        .allowed,
      true,
    );
    assert.equal(
      (await service.consume("user-one", RateLimitAction.MESSAGE_MUTATE))
        .allowed,
      true,
    );
    store.close();
  });

  test("prunes buckets that remain idle", async () => {
    let sweepNow = new Date(0);
    const store = createInMemoryRateLimitStore({
      idleTtlMs: 5,
      now: () => sweepNow,
      sweepIntervalMs: 5,
    });
    const policy = { capacity: 1, refillIntervalMs: 60_000 };
    assert.equal(
      (await store.consume("idle", policy, new Date(0))).allowed,
      true,
    );
    assert.equal(
      (await store.consume("idle", policy, new Date(0))).allowed,
      false,
    );

    sweepNow = new Date(10);
    await new Promise((resolve) => setTimeout(resolve, 15));
    assert.equal(
      (await store.consume("idle", policy, new Date(0))).allowed,
      true,
    );
    store.close();
  });

  test("limits active sockets and frees capacity on release", async () => {
    const store = createInMemoryRateLimitStore();
    const rateLimits = createRateLimitService({ store });
    const connections = createSocketConnectionService({
      maximumConnections: 2,
      rateLimits,
      store: createInMemorySocketConnectionStore(),
    });

    assert.equal(
      (await connections.admit("user-one", "socket-one")).allowed,
      true,
    );
    assert.equal(
      (await connections.admit("user-one", "socket-two")).allowed,
      true,
    );
    const denied = await connections.admit("user-one", "socket-three");
    assert.equal(denied.allowed, false);
    assert.equal(denied.retryAfterMs, 15_000);
    assert.equal(
      (await connections.admit("user-two", "socket-four")).allowed,
      true,
    );

    await connections.release("user-one", "socket-one");
    assert.equal(
      (await connections.admit("user-one", "socket-three")).allowed,
      true,
    );
    store.close();
  });
});
