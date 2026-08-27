// @vitest-environment node

import { NextRequest } from "next/server";
import { describe, expect, it } from "vitest";

import { buildContentSecurityPolicy } from "@/lib/security/csp";
import { proxy } from "@/proxy";

const directive = (policy: string, name: string) =>
  policy
    .split(";")
    .map((value) => value.trim())
    .find((value) => value.startsWith(`${name} `));

describe("frontend content security policy", () => {
  it("builds a strict production script policy with exact socket sources", () => {
    const policy = buildContentSecurityPolicy({
      isDevelopment: false,
      nonce: "test-nonce",
      socketOrigin: "https://api.intouch.example/socket.io",
    });

    expect(directive(policy, "script-src")).toBe(
      "script-src 'self' 'nonce-test-nonce' 'strict-dynamic'",
    );
    expect(directive(policy, "script-src")).not.toContain("'unsafe-inline'");
    expect(directive(policy, "connect-src")).toBe(
      "connect-src 'self' https://api.intouch.example wss://api.intouch.example",
    );
    expect(directive(policy, "style-src-elem")).toBe(
      "style-src-elem 'self' 'unsafe-inline'",
    );
    expect(directive(policy, "style-src-attr")).toBe(
      "style-src-attr 'unsafe-inline'",
    );
    expect(policy).toContain("frame-ancestors 'none'");
    expect(policy).toContain("upgrade-insecure-requests");
  });

  it("allows development evaluation without upgrading local requests", () => {
    const policy = buildContentSecurityPolicy({
      isDevelopment: true,
      nonce: "development-nonce",
      socketOrigin: "http://localhost:3000",
    });

    expect(directive(policy, "script-src")).toContain("'unsafe-eval'");
    expect(directive(policy, "connect-src")).toBe(
      "connect-src 'self' http://localhost:3000 ws://localhost:3000",
    );
    expect(policy).not.toContain("upgrade-insecure-requests");
  });

  it("adds a per-request nonce CSP and complementary security headers", () => {
    const response = proxy(new NextRequest("http://localhost:3001/login"));
    const policy = response.headers.get("content-security-policy");
    const requestNonce = response.headers.get("x-middleware-request-x-nonce");

    expect(policy).toMatch(/'nonce-[A-Za-z0-9+/=]+'/);
    expect(requestNonce).toBeTruthy();
    expect(policy).toContain(`'nonce-${requestNonce}'`);
    expect(response.headers.get("referrer-policy")).toBe(
      "strict-origin-when-cross-origin",
    );
    expect(response.headers.get("x-content-type-options")).toBe("nosniff");
    expect(response.headers.get("permissions-policy")).toContain("camera=()");
  });
});
