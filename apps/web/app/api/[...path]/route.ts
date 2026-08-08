import type { NextRequest } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const getBackendOrigin = () => {
  const configuredOrigin =
    process.env.BACKEND_ORIGIN ?? "http://localhost:3000";
  const url = new URL(configuredOrigin);

  if (!["http:", "https:"].includes(url.protocol)) {
    throw new Error("BACKEND_ORIGIN must be an HTTP(S) origin");
  }

  return url.origin;
};

const proxy = async (request: NextRequest, path: string[]) => {
  const target = new URL(`/api/${path.join("/")}`, getBackendOrigin());
  target.search = request.nextUrl.search;

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

type RouteContext = { params: Promise<{ path: string[] }> };

const handle = async (request: NextRequest, context: RouteContext) => {
  const { path } = await context.params;
  return proxy(request, path);
};

export {
  handle as DELETE,
  handle as GET,
  handle as PATCH,
  handle as POST,
  handle as PUT,
};
