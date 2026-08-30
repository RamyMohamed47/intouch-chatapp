import assert from "node:assert/strict";
import http from "node:http";
import type { AddressInfo } from "node:net";
import { after, before, describe, test } from "node:test";

import { Server } from "socket.io";

import createApp from "../src/app.js";
import type {
  ClientToServerEvents,
  InterServerEvents,
  ServerToClientEvents,
  SocketData,
} from "../src/contracts/socket.js";

process.env.NODE_ENV = "test";

let server: http.Server;
let io: Server<
  ClientToServerEvents,
  ServerToClientEvents,
  InterServerEvents,
  SocketData
>;
let baseUrl: string;

const listen = (httpServer: http.Server) =>
  new Promise<void>((resolve) => {
    httpServer.listen(0, resolve);
  });

const closeServer = (httpServer: http.Server) =>
  new Promise<void>((resolve, reject) => {
    httpServer.close((err) => {
      if (err && "code" in err && err.code === "ERR_SERVER_NOT_RUNNING") {
        resolve();
        return;
      }

      if (err) {
        reject(err);
        return;
      }

      resolve();
    });
  });

const closeSocketServer = (
  socketServer: Server<
    ClientToServerEvents,
    ServerToClientEvents,
    InterServerEvents,
    SocketData
  >,
) =>
  new Promise<void>((resolve, reject) => {
    socketServer.close((err?: Error) => {
      if (err) {
        reject(err);
        return;
      }

      resolve();
    });
  });

before(async () => {
  const app = createApp();

  server = http.createServer(app);
  io = new Server<
    ClientToServerEvents,
    ServerToClientEvents,
    InterServerEvents,
    SocketData
  >(server);

  await listen(server);

  const address = server.address();
  assert.notEqual(address, null);
  assert.notEqual(typeof address, "string");

  baseUrl = `http://127.0.0.1:${(address as AddressInfo).port}`;
});

after(async () => {
  await closeSocketServer(io);
  await closeServer(server);
});

describe("app", () => {
  test("returns health status", async () => {
    const response = await fetch(`${baseUrl}/health`);
    const body = (await response.json()) as {
      status: string;
      timestamp: string;
      uptime: number;
    };

    assert.equal(response.status, 200);
    assert.equal(body.status, "ok");
    assert.equal(typeof body.uptime, "number");
    assert.ok(body.uptime >= 0);
    assert.doesNotThrow(() => new Date(body.timestamp).toISOString());
  });

  test("returns readiness independently from liveness", async () => {
    const readyResponse = await fetch(`${baseUrl}/ready`);
    assert.equal(readyResponse.status, 200);
    assert.equal(
      ((await readyResponse.json()) as { status: string }).status,
      "ready",
    );

    const unavailableServer = http.createServer(
      createApp({ readiness: { isReady: () => false } }),
    );
    await listen(unavailableServer);
    const address = unavailableServer.address();
    assert.ok(address && typeof address !== "string");
    try {
      const response = await fetch(`http://127.0.0.1:${address.port}/ready`);
      assert.equal(response.status, 503);
      assert.equal(
        ((await response.json()) as { status: string }).status,
        "not_ready",
      );
    } finally {
      await closeServer(unavailableServer);
    }
  });

  test("returns a centralized 404 response for the removed frontend root", async () => {
    const response = await fetch(`${baseUrl}/`);
    const body = await response.json();

    assert.equal(response.status, 404);
    assert.deepEqual(body, {
      success: false,
      error: {
        code: "NOT_FOUND",
        message: "Cannot find / on this server",
      },
    });
  });

  test("returns a centralized 404 response for unknown routes", async () => {
    const response = await fetch(`${baseUrl}/not-found`);
    const body = await response.json();

    assert.equal(response.status, 404);
    assert.deepEqual(body, {
      success: false,
      error: {
        code: "NOT_FOUND",
        message: "Cannot find /not-found on this server",
      },
    });
  });

  test("adds a request id response header", async () => {
    const response = await fetch(`${baseUrl}/not-found`);
    const requestId = response.headers.get("x-request-id");

    assert.equal(response.status, 404);
    assert.ok(requestId);
  });

  test("reuses an incoming request id response header", async () => {
    const incomingRequestId = "test-request-id";
    const response = await fetch(`${baseUrl}/not-found`, {
      headers: {
        "X-Request-Id": incomingRequestId,
      },
    });

    assert.equal(response.status, 404);
    assert.equal(response.headers.get("x-request-id"), incomingRequestId);
  });

  test("applies security headers with helmet", async () => {
    const response = await fetch(`${baseUrl}/not-found`);

    assert.equal(response.headers.get("x-content-type-options"), "nosniff");
  });

  test("applies CORS headers", async () => {
    const response = await fetch(`${baseUrl}/not-found`, {
      headers: {
        Origin: "http://localhost:5173",
      },
    });

    assert.equal(
      response.headers.get("access-control-allow-origin"),
      "http://localhost:5173",
    );
    assert.equal(
      response.headers.get("access-control-allow-credentials"),
      "true",
    );
  });

  test("does not expose API resources outside the versioned API mount", async () => {
    const response = await fetch(`${baseUrl}/messages`);
    const body = await response.json();

    assert.equal(response.status, 404);
    assert.deepEqual(body, {
      success: false,
      error: {
        code: "NOT_FOUND",
        message: "Cannot find /messages on this server",
      },
    });
  });

  test("removes the prototype collection-wide messages resource", async () => {
    const response = await fetch(`${baseUrl}/api/v1/messages`);
    assert.equal(response.status, 404);
  });

  test("serves the Socket.IO client script without falling through to Express", async () => {
    const response = await fetch(`${baseUrl}/socket.io/socket.io.js`);
    const body = await response.text();
    const contentType = response.headers.get("content-type");

    assert.equal(response.status, 200);
    assert.ok(contentType);
    assert.match(contentType, /javascript/);
    assert.match(body, /socket.io/);
  });
});
