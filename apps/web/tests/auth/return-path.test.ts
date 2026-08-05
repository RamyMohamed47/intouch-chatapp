import { describe, expect, it } from "vitest";

import { getSafeReturnPath } from "@/lib/auth/return-path";

describe("safe authentication return paths", () => {
  it("preserves internal application routes", () => {
    expect(getSafeReturnPath("/app/abc?tab=members")).toBe(
      "/app/abc?tab=members",
    );
  });

  it.each([
    "https://evil.example/app",
    "//evil.example/app",
    "/login",
    "/application",
    "not-a-path",
    null,
  ])("rejects unsafe return target %s", (target) => {
    expect(getSafeReturnPath(target)).toBe("/app");
  });
});
