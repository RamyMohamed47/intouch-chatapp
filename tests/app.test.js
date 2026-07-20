import assert from "node:assert/strict";
import http from "node:http";
import { after, before, describe, test } from "node:test";

import { Server } from "socket.io";

import createApp from "../app.js";

process.env.NODE_ENV = "test";

let server;
let io;
let baseUrl;

before(async () => {
  const app = createApp();

  server = http.createServer(app);
  io = new Server(server);

  app.set("io", io);

  await new Promise((resolve) => server.listen(0, resolve));
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

after(async () => {
  await new Promise((resolve) => io.close(resolve));
  await new Promise((resolve) => server.close(resolve));
});

describe("app", () => {
  test("serves the public index page", async () => {
    const response = await fetch(`${baseUrl}/`);
    const html = await response.text();

    assert.equal(response.status, 200);
    assert.match(html, /InTouch/);
  });

  test("returns a centralized 404 response for unknown routes", async () => {
    const response = await fetch(`${baseUrl}/not-found`);
    const body = await response.json();

    assert.equal(response.status, 404);
    assert.deepEqual(body, {
      status: "fail",
      message: "Cannot find /not-found on this server",
    });
  });

  test("does not expose API resources outside the versioned API mount", async () => {
    const response = await fetch(`${baseUrl}/messages`);
    const body = await response.json();

    assert.equal(response.status, 404);
    assert.deepEqual(body, {
      status: "fail",
      message: "Cannot find /messages on this server",
    });
  });

  test("mounts the messages resource under the versioned API", async () => {
    const response = await fetch(`${baseUrl}/api/v1/messages`, {
      method: "OPTIONS",
    });
    const allowedMethods = response.headers.get("allow");

    assert.equal(response.status, 200);
    assert.match(allowedMethods, /GET/);
    assert.match(allowedMethods, /POST/);
  });

  test("serves the Socket.IO client script without falling through to Express", async () => {
    const response = await fetch(`${baseUrl}/socket.io/socket.io.js`);
    const body = await response.text();

    assert.equal(response.status, 200);
    assert.match(response.headers.get("content-type"), /javascript/);
    assert.match(body, /socket.io/);
  });
});
