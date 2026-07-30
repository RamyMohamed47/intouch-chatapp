import assert from "node:assert/strict";
import http from "node:http";
import { after, before, describe, test } from "node:test";

import createApp from "../src/app.js";
import createAuthController from "../src/modules/auth/auth.controller.js";
import { GoogleProviderUnavailableError } from "../src/modules/auth/auth.errors.js";
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
const stateCookie = {
  name: "intouch_google_oauth_state",
  secure: true,
  maxAgeMs: 10 * 60 * 1000,
};
const googleState = "google-oauth-state";
const googleFrontendRedirectUrl = `${origin}/auth/callback`;
const user: PublicUser = {
  id: "507f1f77bcf86cd799439011",
  username: "ramy_47",
  displayName: "Ramy Mohamed",
  email: "ramy@example.com",
  status: UserStatus.OFFLINE,
  createdAt: new Date("2026-07-28T12:00:00.000Z"),
  updatedAt: new Date("2026-07-28T12:00:00.000Z"),
};
let googleLoginError: Error | undefined;
const authService: AuthService = {
  getGoogleAuthorizationUrl: (state) =>
    `https://accounts.google.test/oauth?state=${state}`,
  loginWithGoogle: async () => {
    if (googleLoginError) {
      throw googleLoginError;
    }

    return { refreshToken: "google-refresh-token" };
  },
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
const oauthStates = {
  create: () => googleState,
  verify: (receivedState: string, expectedState: string) =>
    receivedState === expectedState,
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
  const controller = createAuthController(authService, cookie, {
    frontendRedirectUrl: googleFrontendRedirectUrl,
    stateCookie,
    states: oauthStates,
  });
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
  test("starts Google OAuth with an HttpOnly state cookie", async () => {
    const response = await fetch(`${baseUrl}/api/v1/auth/oauth/google`, {
      redirect: "manual",
    });
    const setCookie = response.headers.get("set-cookie");

    assert.equal(response.status, 302);
    assert.equal(
      response.headers.get("location"),
      `https://accounts.google.test/oauth?state=${googleState}`,
    );
    assert.ok(setCookie);
    assert.match(setCookie, /intouch_google_oauth_state=google-oauth-state/);
    assert.match(setCookie, /HttpOnly/i);
    assert.match(setCookie, /Secure/i);
    assert.match(setCookie, /SameSite=Lax/i);
    assert.match(setCookie, /Path=\/api\/v1\/auth\/oauth\/google/i);
    assert.match(setCookie, /Max-Age=600/i);
  });

  test("completes Google OAuth with a refresh cookie and safe redirect", async () => {
    const response = await fetch(
      `${baseUrl}/api/v1/auth/oauth/google/callback?code=google-code&state=${googleState}`,
      {
        headers: {
          Cookie: `intouch_google_oauth_state=${googleState}`,
        },
        redirect: "manual",
      },
    );
    const setCookie = response.headers.get("set-cookie");
    const location = response.headers.get("location");

    assert.equal(response.status, 302);
    assert.equal(location, `${googleFrontendRedirectUrl}?googleAuth=success`);
    assert.ok(setCookie);
    assert.match(setCookie, /intouch_google_oauth_state=;/);
    assert.match(setCookie, /intouch_refresh=google-refresh-token/);
    assert.doesNotMatch(location ?? "", /google-code|accessToken|refreshToken/);
  });

  test("rejects a replayed Google callback with a generic redirect", async () => {
    const response = await fetch(
      `${baseUrl}/api/v1/auth/oauth/google/callback?code=google-code&state=${googleState}`,
      { redirect: "manual" },
    );

    assert.equal(response.status, 302);
    assert.equal(
      response.headers.get("location"),
      `${googleFrontendRedirectUrl}?googleAuth=failed`,
    );
    assert.doesNotMatch(
      response.headers.get("set-cookie") ?? "",
      /intouch_refresh=/,
    );
  });

  test("redirects cancelled Google authentication without creating a session", async () => {
    const response = await fetch(
      `${baseUrl}/api/v1/auth/oauth/google/callback?error=access_denied&state=${googleState}`,
      {
        headers: {
          Cookie: `intouch_google_oauth_state=${googleState}`,
        },
        redirect: "manual",
      },
    );

    assert.equal(response.status, 302);
    assert.equal(
      response.headers.get("location"),
      `${googleFrontendRedirectUrl}?googleAuth=failed`,
    );
    assert.doesNotMatch(
      response.headers.get("set-cookie") ?? "",
      /intouch_refresh=/,
    );
  });

  test("preserves the generic redirect during a Google provider outage", async () => {
    googleLoginError = new GoogleProviderUnavailableError();

    try {
      const response = await fetch(
        `${baseUrl}/api/v1/auth/oauth/google/callback?code=google-code&state=${googleState}`,
        {
          headers: {
            Cookie: `intouch_google_oauth_state=${googleState}`,
          },
          redirect: "manual",
        },
      );

      assert.equal(response.status, 302);
      assert.equal(
        response.headers.get("location"),
        `${googleFrontendRedirectUrl}?googleAuth=failed`,
      );
    } finally {
      googleLoginError = undefined;
    }
  });

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
    const controller = createAuthController(authService, cookie, {
      frontendRedirectUrl: googleFrontendRedirectUrl,
      stateCookie,
      states: oauthStates,
    });
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
        success: false,
        error: {
          code: "TOO_MANY_REQUESTS",
          message: "Too many registration attempts",
        },
      });
    } finally {
      await new Promise<void>((resolve, reject) => {
        limitedServer.close((error) => (error ? reject(error) : resolve()));
      });
    }
  });

  test("rate limits Google OAuth start attempts independently", async () => {
    const controller = createAuthController(authService, cookie, {
      frontendRedirectUrl: googleFrontendRedirectUrl,
      stateCookie,
      states: oauthStates,
    });
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
      for (let attempt = 0; attempt < 10; attempt += 1) {
        const response = await fetch(
          `${limitedBaseUrl}/api/v1/auth/oauth/google`,
          { redirect: "manual" },
        );
        assert.equal(response.status, 302);
      }

      const response = await fetch(
        `${limitedBaseUrl}/api/v1/auth/oauth/google`,
        { redirect: "manual" },
      );

      assert.equal(response.status, 429);
      assert.deepEqual(await response.json(), {
        success: false,
        error: {
          code: "TOO_MANY_REQUESTS",
          message: "Too many Google login attempts",
        },
      });
    } finally {
      await new Promise<void>((resolve, reject) => {
        limitedServer.close((error) => (error ? reject(error) : resolve()));
      });
    }
  });
});
