import assert from "node:assert/strict";
import http from "node:http";
import { after, before, describe, test } from "node:test";

import createApp from "../src/app.js";
import createAuthController from "../src/modules/auth/auth.controller.js";
import createAuthMiddleware from "../src/modules/auth/auth.middleware.js";
import createAuthRouter from "../src/modules/auth/auth.routes.js";
import type { AuthService } from "../src/modules/auth/auth.service.js";
import type { AccessTokenManager } from "../src/modules/auth/auth.types.js";
import { UserStatus, type PublicUser } from "../src/modules/user/user.types.js";

process.env.NODE_ENV = "test";

const origin = "https://app.example.com";
const cookie = {
  name: "intouch_refresh",
  secure: true,
  maxAgeMs: 30 * 24 * 60 * 60 * 1000,
};
const user: PublicUser = {
  id: "507f1f77bcf86cd799439011",
  username: "ramy_47",
  displayName: "Ramy Mohamed",
  email: "ramy@example.com",
  status: UserStatus.OFFLINE,
  createdAt: new Date("2026-07-28T12:00:00.000Z"),
  updatedAt: new Date("2026-07-28T12:00:00.000Z"),
};
const authService: AuthService = {
  register: async () => ({
    user,
    accessToken: "register-access-token",
    refreshToken: "register-refresh-token",
  }),
  login: async () => ({
    user,
    accessToken: "login-access-token",
    refreshToken: "login-refresh-token",
  }),
  refresh: async () => ({
    accessToken: "rotated-access-token",
    refreshToken: "rotated-refresh-token",
  }),
  getCurrentUser: async () => user,
};
const accessTokens: AccessTokenManager = {
  sign: async () => "unused",
  verify: async (token) => {
    if (token !== "valid-access-token") {
      throw new Error("invalid token");
    }

    return { userId: user.id };
  },
};

let server: http.Server;
let baseUrl: string;

before(async () => {
  const controller = createAuthController(authService, cookie);
  const middleware = createAuthMiddleware({
    accessTokens,
    cookie,
    allowedOrigins: [origin],
  });
  const authRouter = createAuthRouter(controller, middleware, {
    rateLimitsEnabled: false,
  });
  const app = createApp({
    allowedOrigins: [origin],
    authRouter,
  });

  server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, resolve));
  const address = server.address();
  assert.ok(address && typeof address !== "string");
  baseUrl = `http://127.0.0.1:${address.port}`;
});

after(async () => {
  await new Promise<void>((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
  });
});

describe("auth routes", () => {
  test("registers with a secure HttpOnly cookie and no token in JSON", async () => {
    const response = await fetch(`${baseUrl}/api/v1/auth/register`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Origin: origin,
      },
      body: JSON.stringify({
        username: user.username,
        displayName: user.displayName,
        email: user.email,
        password: "correct horse battery staple",
      }),
    });
    const body = (await response.json()) as Record<string, unknown>;
    const setCookie = response.headers.get("set-cookie");

    assert.equal(response.status, 201);
    assert.equal(body.accessToken, "register-access-token");
    assert.equal("refreshToken" in body, false);
    assert.ok(setCookie);
    assert.match(setCookie, /intouch_refresh=register-refresh-token/);
    assert.match(setCookie, /HttpOnly/i);
    assert.match(setCookie, /Secure/i);
    assert.match(setCookie, /SameSite=Lax/i);
    assert.match(setCookie, /Path=\/api\/v1\/auth/i);
  });

  test("rejects refresh without CSRF protection", async () => {
    const response = await fetch(`${baseUrl}/api/v1/auth/refresh`, {
      method: "POST",
      headers: {
        Cookie: "intouch_refresh=register-refresh-token",
        Origin: origin,
      },
    });

    assert.equal(response.status, 403);
  });

  test("rotates a cookie without exposing it in JSON", async () => {
    const response = await fetch(`${baseUrl}/api/v1/auth/refresh`, {
      method: "POST",
      headers: {
        Cookie: "intouch_refresh=register-refresh-token",
        Origin: origin,
        "X-CSRF-Protection": "1",
      },
    });
    const body = (await response.json()) as Record<string, unknown>;
    const setCookie = response.headers.get("set-cookie");

    assert.equal(response.status, 200);
    assert.deepEqual(body, { accessToken: "rotated-access-token" });
    assert.ok(setCookie);
    assert.match(setCookie, /rotated-refresh-token/);
  });

  test("returns the current user for a Bearer token", async () => {
    const response = await fetch(`${baseUrl}/api/v1/auth/me`, {
      headers: {
        Authorization: "Bearer valid-access-token",
        Origin: origin,
      },
    });
    const body = (await response.json()) as { user: PublicUser };

    assert.equal(response.status, 200);
    assert.equal(body.user.email, user.email);
    assert.equal("loginProviders" in body.user, false);
  });

  test("rejects missing Bearer credentials", async () => {
    const response = await fetch(`${baseUrl}/api/v1/auth/me`, {
      headers: { Origin: origin },
    });

    assert.equal(response.status, 401);
  });

  test("returns shared-schema validation failures as bad requests", async () => {
    const response = await fetch(`${baseUrl}/api/v1/auth/login`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Origin: origin,
      },
      body: JSON.stringify({ email: "invalid", password: "short" }),
    });

    assert.equal(response.status, 400);
  });

  test("returns credentialed CORS headers for an allowed origin", async () => {
    const response = await fetch(`${baseUrl}/health`, {
      headers: { Origin: origin },
    });

    assert.equal(response.headers.get("access-control-allow-origin"), origin);
    assert.equal(
      response.headers.get("access-control-allow-credentials"),
      "true",
    );
  });

  test("rejects an untrusted origin", async () => {
    const response = await fetch(`${baseUrl}/health`, {
      headers: { Origin: "https://attacker.example" },
    });

    assert.equal(response.status, 403);
  });

  test("returns the standard error envelope after the registration limit", async () => {
    const controller = createAuthController(authService, cookie);
    const middleware = createAuthMiddleware({
      accessTokens,
      cookie,
      allowedOrigins: [origin],
    });
    const limitedApp = createApp({
      allowedOrigins: [origin],
      authRouter: createAuthRouter(controller, middleware),
    });
    const limitedServer = http.createServer(limitedApp);

    await new Promise<void>((resolve) => limitedServer.listen(0, resolve));
    const address = limitedServer.address();
    assert.ok(address && typeof address !== "string");
    const limitedBaseUrl = `http://127.0.0.1:${address.port}`;

    try {
      for (let attempt = 0; attempt < 5; attempt += 1) {
        const response = await fetch(`${limitedBaseUrl}/api/v1/auth/register`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Origin: origin,
          },
          body: JSON.stringify({
            username: user.username,
            displayName: user.displayName,
            email: user.email,
            password: "correct horse battery staple",
          }),
        });
        assert.equal(response.status, 201);
      }

      const response = await fetch(`${limitedBaseUrl}/api/v1/auth/register`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Origin: origin,
        },
        body: JSON.stringify({
          username: user.username,
          displayName: user.displayName,
          email: user.email,
          password: "correct horse battery staple",
        }),
      });

      assert.equal(response.status, 429);
      assert.deepEqual(await response.json(), {
        status: "fail",
        message: "Too many registration attempts",
      });
    } finally {
      await new Promise<void>((resolve, reject) => {
        limitedServer.close((error) => (error ? reject(error) : resolve()));
      });
    }
  });
});
