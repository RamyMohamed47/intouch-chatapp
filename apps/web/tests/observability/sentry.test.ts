import { describe, expect, it } from "vitest";

import {
  sanitizeSentryBreadcrumb,
  sanitizeSentryEvent,
} from "@/lib/observability/sentry";

describe("Sentry privacy", () => {
  it("removes request payloads, query values, and direct identifiers", () => {
    const event = sanitizeSentryEvent({
      type: undefined,
      contexts: { private: { email: "person@example.com" } },
      extra: { message: "private content" },
      request: {
        cookies: { refresh: "secret" },
        data: { password: "secret" },
        headers: { authorization: "Bearer secret" },
        method: "GET",
        query_string: "q=private",
        url: "https://app.example.com/search?q=private#result",
      },
      user: { email: "person@example.com", id: "opaque-id" },
    });

    expect(event.request).toEqual({
      method: "GET",
      url: "https://app.example.com/search",
    });
    expect(event.user).toEqual({ id: "opaque-id" });
    expect(event.contexts).toBeUndefined();
    expect(event.extra).toBeUndefined();
  });

  it("drops breadcrumb data while retaining diagnostic text", () => {
    expect(
      sanitizeSentryBreadcrumb({
        category: "fetch",
        data: { url: "/api/search?q=private" },
        message: "Request failed",
      }),
    ).toEqual({ category: "fetch", message: "Request failed" });
  });
});
