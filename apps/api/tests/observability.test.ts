import assert from "node:assert/strict";
import { describe, test } from "node:test";

import { sanitizeSentryEvent } from "../src/infrastructure/observability/observability.sentry.js";

describe("observability privacy", () => {
  test("removes request content, query values, PII, and arbitrary context", () => {
    const event = sanitizeSentryEvent({
      type: undefined,
      breadcrumbs: [
        {
          category: "fetch",
          data: { authorization: "Bearer secret" },
          message: "request failed",
        },
      ],
      contexts: { private: { email: "person@example.com" } },
      extra: { content: "private message" },
      request: {
        cookies: { refresh: "secret" },
        data: { password: "secret" },
        headers: { authorization: "Bearer secret" },
        method: "GET",
        query_string: "q=private",
        url: "https://api.example.com/search?q=private#result",
      },
      user: { email: "person@example.com", id: "opaque-user-id" },
    });

    assert.deepEqual(event.request, {
      method: "GET",
      url: "https://api.example.com/search",
    });
    assert.deepEqual(event.user, { id: "opaque-user-id" });
    assert.equal(event.contexts, undefined);
    assert.equal(event.extra, undefined);
    assert.deepEqual(event.breadcrumbs, [
      { category: "fetch", message: "request failed" },
    ]);
  });
});
