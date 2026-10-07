import assert from "node:assert/strict";
import http from "node:http";
import type { AddressInfo } from "node:net";
import { after, before, describe, test } from "node:test";

import express from "express";

import createTrustedClientIp, {
  CLIENT_IP_HEADER,
  PROXY_SECRET_HEADER,
} from "../src/middleware/trustedClientIp.js";

const secret = "a-proxy-client-ip-secret-over-32-bytes";
const servers: http.Server[] = [];

const start = async (configuredSecret?: string) => {
  const app = express();
  app.use(createTrustedClientIp(configuredSecret));
  app.get("/", (req, res) => {
    res.json({
      ip: req.ip,
      forwardedHeaders: [CLIENT_IP_HEADER, PROXY_SECRET_HEADER].filter(
        (name) => req.get(name) !== undefined,
      ),
    });
  });
  const server = http.createServer(app);
  servers.push(server);
  await new Promise<void>((resolve) => {
    server.listen(0, "127.0.0.1", resolve);
  });
  return `http://127.0.0.1:${(server.address() as AddressInfo).port}/`;
};

const request = async (url: string, headers: Record<string, string>) =>
  (await (await fetch(url, { headers })).json()) as {
    ip: string;
    forwardedHeaders: string[];
  };

let protectedUrl: string;
let unconfiguredUrl: string;

before(async () => {
  protectedUrl = await start(secret);
  unconfiguredUrl = await start();
});

after(async () => {
  await Promise.all(
    servers.map(
      (server) =>
        new Promise<void>((resolve) => {
          server.close(() => resolve());
        }),
    ),
  );
});

describe("trusted client IP", () => {
  test("uses the proxied address when the shared secret matches", async () => {
    const body = await request(protectedUrl, {
      [CLIENT_IP_HEADER]: "203.0.113.7",
      [PROXY_SECRET_HEADER]: secret,
    });

    assert.equal(body.ip, "203.0.113.7");
    assert.deepEqual(body.forwardedHeaders, []);
  });

  test("accepts IPv6 addresses", async () => {
    const body = await request(protectedUrl, {
      [CLIENT_IP_HEADER]: "2001:db8::7",
      [PROXY_SECRET_HEADER]: secret,
    });

    assert.equal(body.ip, "2001:db8::7");
  });

  test("ignores the address without the correct secret", async () => {
    for (const headers of [
      { [CLIENT_IP_HEADER]: "203.0.113.7" },
      { [CLIENT_IP_HEADER]: "203.0.113.7", [PROXY_SECRET_HEADER]: "guess" },
    ]) {
      const body = await request(protectedUrl, headers);

      assert.notEqual(body.ip, "203.0.113.7");
      assert.deepEqual(body.forwardedHeaders, []);
    }
  });

  test("ignores values that are not IP addresses", async () => {
    const body = await request(protectedUrl, {
      [CLIENT_IP_HEADER]: "not-an-address",
      [PROXY_SECRET_HEADER]: secret,
    });

    assert.notEqual(body.ip, "not-an-address");
  });

  test("never trusts the header when no secret is configured", async () => {
    const body = await request(unconfiguredUrl, {
      [CLIENT_IP_HEADER]: "203.0.113.7",
      [PROXY_SECRET_HEADER]: secret,
    });

    assert.notEqual(body.ip, "203.0.113.7");
    assert.deepEqual(body.forwardedHeaders, []);
  });
});
