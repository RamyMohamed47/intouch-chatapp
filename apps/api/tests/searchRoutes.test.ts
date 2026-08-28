import assert from "node:assert/strict";
import http from "node:http";
import { after, before, describe, test } from "node:test";

import { SearchType } from "@intouch/shared/search";
import type { RequestHandler } from "express";

import createApp from "../src/app.js";
import UnauthorizedError from "../src/errors/UnauthorizedError.js";
import type { AuthLocals } from "../src/modules/auth/auth.types.js";
import createSearchController from "../src/modules/search/search.controller.js";
import createSearchRouter from "../src/modules/search/search.routes.js";
import type { SearchService } from "../src/modules/search/search.service.js";

process.env.NODE_ENV = "test";

const userId = "507f1f77bcf86cd799439001";
const organizationId = "507f1f77bcf86cd799439002";
let receivedQuery: unknown;
let limiterCalls = 0;

const service = {
  search: async (_userId: string, _organizationId: string, query: unknown) => {
    receivedQuery = query;
    return {
      query: "roadmap",
      type: SearchType.MESSAGES,
      results: [],
      nextCursor: null,
    };
  },
} as SearchService;

const requireAccessToken: RequestHandler = (req, res, next) => {
  if (req.get("authorization") !== "Bearer valid-token") {
    next(new UnauthorizedError());
    return;
  }
  (res.locals as AuthLocals).userId = userId;
  next();
};

const searchLimit: RequestHandler = (_req, _res, next) => {
  limiterCalls += 1;
  next();
};

let server: http.Server;
let baseUrl: string;

before(async () => {
  const controller = createSearchController(service);
  const router = createSearchRouter(
    controller,
    requireAccessToken,
    searchLimit,
  );
  server = http.createServer(createApp({ searchRouter: router }));
  await new Promise<void>((resolve) => server.listen(0, resolve));
  const address = server.address();
  assert.ok(address && typeof address !== "string");
  baseUrl = `http://127.0.0.1:${address.port}`;
});

after(async () => {
  await new Promise<void>((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
  });
});

describe("organization search routes", () => {
  test("requires authentication before consuming the account limit", async () => {
    const before = limiterCalls;
    const response = await fetch(
      `${baseUrl}/api/v1/organizations/${organizationId}/search?q=roadmap`,
    );
    assert.equal(response.status, 401);
    assert.equal(limiterCalls, before);
  });

  test("normalizes typed search queries", async () => {
    const response = await fetch(
      `${baseUrl}/api/v1/organizations/${organizationId}/search?q=%20roadmap%20&type=MESSAGES&limit=10`,
      { headers: { Authorization: "Bearer valid-token" } },
    );
    assert.equal(response.status, 200);
    assert.deepEqual(receivedQuery, {
      q: "roadmap",
      type: SearchType.MESSAGES,
      limit: 10,
    });
  });

  test("rejects malformed filters after consuming a search attempt", async () => {
    const before = limiterCalls;
    const response = await fetch(
      `${baseUrl}/api/v1/organizations/${organizationId}/search?q=a&type=ALL&conversationId=${organizationId}`,
      { headers: { Authorization: "Bearer valid-token" } },
    );
    const body = (await response.json()) as {
      error: { code: string };
    };
    assert.equal(response.status, 400);
    assert.equal(body.error.code, "VALIDATION_ERROR");
    assert.equal(limiterCalls, before + 1);
  });
});
