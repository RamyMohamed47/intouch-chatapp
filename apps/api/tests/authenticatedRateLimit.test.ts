import assert from "node:assert/strict";
import { after, before, describe, test } from "node:test";
import http from "node:http";

import express, { type RequestHandler } from "express";

import createApp from "../src/app.js";
import createAuthenticatedRateLimit from "../src/middleware/authenticatedRateLimit.js";
import {
  createInMemoryRateLimitStore,
  createRateLimitService,
  RateLimitAction,
  type TokenBucketPolicy,
} from "../src/modules/abuse-protection/index.js";

const userId = "507f1f77bcf86cd799439011";
const policy = { capacity: 1, refillIntervalMs: 60_000 };
const policies = Object.fromEntries(
  Object.values(RateLimitAction).map((action) => [action, policy]),
) as Record<RateLimitAction, TokenBucketPolicy>;
const store = createInMemoryRateLimitStore();
const rateLimits = createRateLimitService({ policies, store });
const router = express.Router();
const authenticate: RequestHandler = (_req, res, next) => {
  res.locals.userId = userId;
  next();
};
router.use(authenticate);
router.get("/write", (_req, res) => res.status(200).json({ ok: true }));
router.post(
  "/write",
  createAuthenticatedRateLimit(
    rateLimits,
    RateLimitAction.MESSAGE_CREATE,
    "Too many message creation attempts",
  ),
  (_req, res) => res.status(400).json({ rejected: true }),
);
const app = createApp({ messageRouter: router });
const server = http.createServer(app);
let baseUrl: string;

before(async () => {
  await new Promise<void>((resolve) => server.listen(0, resolve));
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("No test port");
  baseUrl = `http://127.0.0.1:${address.port}`;
});

after(async () => {
  store.close();
  await new Promise<void>((resolve, reject) =>
    server.close((error) => (error ? reject(error) : resolve())),
  );
});

describe("authenticated HTTP rate limits", () => {
  test("counts failed writes and returns the standard 429 envelope", async () => {
    const url = `${baseUrl}/api/v1/messages/write`;
    assert.equal((await fetch(url, { method: "POST" })).status, 400);

    const response = await fetch(url, { method: "POST" });
    assert.equal(response.status, 429);
    assert.equal(response.headers.get("retry-after"), "60");
    assert.deepEqual(await response.json(), {
      success: false,
      error: {
        code: "TOO_MANY_REQUESTS",
        message: "Too many message creation attempts",
      },
    });
  });

  test("does not apply the write limiter to GET requests", async () => {
    assert.equal((await fetch(`${baseUrl}/api/v1/messages/write`)).status, 200);
  });
});
