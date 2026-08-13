import { describe, expect, it } from "vitest";

import { buildBackendProxyTarget } from "@/lib/api/proxy-target";

describe("backend proxy target", () => {
  it("preserves trailing slashes and query parameters", () => {
    const target = buildBackendProxyTarget(
      { pathname: "/api/docs/", search: "?filter=auth" },
      "https://api.intouch.example/internal-path",
    );

    expect(target.href).toBe(
      "https://api.intouch.example/api/docs/?filter=auth",
    );
  });

  it("rejects non-HTTP backend origins", () => {
    expect(() =>
      buildBackendProxyTarget(
        { pathname: "/api/docs/", search: "" },
        "file:///tmp/intouch",
      ),
    ).toThrow("BACKEND_ORIGIN must be an HTTP(S) origin");
  });
});
