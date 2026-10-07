import { describe, expect, it } from "vitest";

import {
  applyProxyClientIp,
  CLIENT_IP_HEADER,
  PROXY_SECRET_HEADER,
} from "@/lib/api/client-ip";

const secret = "a-proxy-client-ip-secret-over-32-bytes";

describe("proxy client IP", () => {
  it("forwards the edge-appended address with the shared secret", () => {
    const headers = new Headers({
      "x-forwarded-for": "198.51.100.9, 203.0.113.7",
    });

    applyProxyClientIp(headers, secret);

    expect(headers.get(CLIENT_IP_HEADER)).toBe("203.0.113.7");
    expect(headers.get(PROXY_SECRET_HEADER)).toBe(secret);
  });

  it("falls back to the real-IP header", () => {
    const headers = new Headers({ "x-real-ip": "203.0.113.7" });

    applyProxyClientIp(headers, secret);

    expect(headers.get(CLIENT_IP_HEADER)).toBe("203.0.113.7");
  });

  it("never passes through browser-supplied proxy headers", () => {
    const headers = new Headers({
      [CLIENT_IP_HEADER]: "192.0.2.1",
      [PROXY_SECRET_HEADER]: "guess",
    });

    applyProxyClientIp(headers, secret);

    expect(headers.has(CLIENT_IP_HEADER)).toBe(false);
    expect(headers.has(PROXY_SECRET_HEADER)).toBe(false);
  });

  it("sends nothing when the secret is not configured", () => {
    const headers = new Headers({ "x-forwarded-for": "203.0.113.7" });

    applyProxyClientIp(headers, "");

    expect(headers.has(CLIENT_IP_HEADER)).toBe(false);
    expect(headers.has(PROXY_SECRET_HEADER)).toBe(false);
  });
});
