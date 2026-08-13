import type { NextRequest } from "next/server";

import { buildBackendProxyTarget } from "@/lib/api/proxy-target";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const proxy = async (request: NextRequest) => {
  const target = buildBackendProxyTarget(request.nextUrl);

  const headers = new Headers(request.headers);
  headers.set("accept-encoding", "identity");
  headers.delete("connection");
  headers.delete("content-length");
  headers.delete("host");

  const response = await fetch(target, {
    method: request.method,
    headers,
    body:
      request.method === "GET" || request.method === "HEAD"
        ? undefined
        : await request.arrayBuffer(),
    cache: "no-store",
    redirect: "manual",
  });
  const responseHeaders = new Headers(response.headers);
  responseHeaders.delete("connection");
  responseHeaders.delete("content-encoding");
  responseHeaders.delete("content-length");
  responseHeaders.delete("transfer-encoding");

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers: responseHeaders,
  });
};

const handle = (request: NextRequest) => proxy(request);

export {
  handle as DELETE,
  handle as GET,
  handle as PATCH,
  handle as POST,
  handle as PUT,
};
