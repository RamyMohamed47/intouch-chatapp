import { NextResponse, type NextRequest } from "next/server";

import { buildContentSecurityPolicy } from "@/lib/security/csp";

const securityHeaders = {
  "Permissions-Policy":
    "camera=(), microphone=(), geolocation=(), payment=(), usb=()",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "X-Content-Type-Options": "nosniff",
} as const;

export function proxy(request: NextRequest) {
  const nonce = Buffer.from(crypto.randomUUID()).toString("base64");
  const contentSecurityPolicy = buildContentSecurityPolicy({
    isDevelopment: process.env.NODE_ENV === "development",
    nonce,
    socketOrigin:
      process.env.NEXT_PUBLIC_SOCKET_ORIGIN ?? "http://localhost:3000",
    storageOrigin: process.env.NEXT_PUBLIC_R2_ORIGIN,
    sentryDsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  });
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-nonce", nonce);
  requestHeaders.set("Content-Security-Policy", contentSecurityPolicy);

  const response = NextResponse.next({ request: { headers: requestHeaders } });
  response.headers.set("Content-Security-Policy", contentSecurityPolicy);
  for (const [name, value] of Object.entries(securityHeaders)) {
    response.headers.set(name, value);
  }
  return response;
}

export const config = {
  matcher: [
    {
      source:
        "/((?!api|_next/static|_next/image|favicon.ico|icon.png|apple-icon.png|manifest.webmanifest|brand/|wallpapers/).*)",
      missing: [
        { type: "header", key: "next-router-prefetch" },
        { type: "header", key: "purpose", value: "prefetch" },
      ],
    },
  ],
};
