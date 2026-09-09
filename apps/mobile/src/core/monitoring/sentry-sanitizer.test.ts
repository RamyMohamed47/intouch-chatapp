import {
  sanitizeSentryRecord,
  sanitizeSentryText,
} from "@/core/monitoring/sentry-sanitizer";

describe("mobile Sentry sanitization", () => {
  it("removes secrets and private content recursively", () => {
    expect(
      sanitizeSentryRecord({
        authorization: "Bearer secret",
        messageContent: "private message",
        path: "/api/v1/search?q=private",
        nested: { email: "ramy@example.com", count: 2 },
        sources: ["private excerpt"],
      }),
    ).toEqual({
      path: "/api/v1/search?[redacted]",
      nested: { email: "[email]", count: 2 },
      sources: "[redacted-array]",
    });
  });

  it("redacts emails and URL query values", () => {
    expect(sanitizeSentryText("ramy@example.com /asset?signature=secret")).toBe(
      "[email] /asset?[redacted]",
    );
  });
});
