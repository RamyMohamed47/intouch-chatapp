import assert from "node:assert/strict";
import { describe, test } from "node:test";

import type { GenerateAuthUrlOpts, TokenPayload } from "google-auth-library";

import {
  GoogleProviderUnavailableError,
  InvalidGoogleAuthenticationError,
} from "../src/modules/auth/auth.errors.js";
import {
  createGoogleOAuthClient,
  type GoogleOAuthFailureDetails,
} from "../src/modules/auth/auth.google.js";
import { createOAuthStateManager } from "../src/modules/auth/auth.oauth-state.js";

const config = {
  callbackUrl: "https://app.example.com/api/v1/auth/oauth/google/callback",
  clientId: "google-client-id",
  clientSecret: "google-client-secret",
};

const payload: TokenPayload = {
  iss: "https://accounts.google.com",
  sub: "google-account-id",
  aud: config.clientId,
  iat: 1,
  exp: 2,
  email: " Ramy@Example.com ",
  email_verified: true,
  name: "  Ramy Mohamed  ",
  picture: "https://example.com/avatar.png",
};

const createSdk = (tokenPayload: TokenPayload | undefined = payload) => ({
  generateAuthUrl: () => "https://accounts.google.test/oauth",
  getToken: async () => ({
    tokens: { id_token: "google-id-token" },
  }),
  verifyIdToken: async () => ({
    getPayload: () => tokenPayload,
  }),
});

describe("Google OAuth client", () => {
  test("generates the authorization URL with minimal sign-in scopes", () => {
    let options: GenerateAuthUrlOpts | undefined;
    const sdk = {
      ...createSdk(),
      generateAuthUrl: (value: GenerateAuthUrlOpts) => {
        options = value;
        return "https://accounts.google.test/oauth";
      },
    };
    const client = createGoogleOAuthClient(config, sdk);

    const url = client.getAuthorizationUrl("oauth-state");

    assert.equal(url, "https://accounts.google.test/oauth");
    assert.deepEqual(options, {
      access_type: "online",
      prompt: "select_account",
      redirect_uri: config.callbackUrl,
      scope: ["openid", "email", "profile"],
      state: "oauth-state",
    });
  });

  test("exchanges a code and normalizes verified identity claims", async () => {
    let verifiedOptions: { audience: string; idToken: string } | undefined;
    const sdk = {
      ...createSdk(),
      verifyIdToken: async (options: { audience: string; idToken: string }) => {
        verifiedOptions = options;
        return { getPayload: () => payload };
      },
    };
    const client = createGoogleOAuthClient(config, sdk);

    const identity = await client.exchangeCode("authorization-code");

    assert.deepEqual(verifiedOptions, {
      audience: config.clientId,
      idToken: "google-id-token",
    });
    assert.deepEqual(identity, {
      providerAccountId: "google-account-id",
      email: "ramy@example.com",
      displayName: "Ramy Mohamed",
      avatarUrl: "https://example.com/avatar.png",
    });
  });

  test("rejects missing or unverified identity claims", async () => {
    const client = createGoogleOAuthClient(config, {
      ...createSdk({ ...payload, email_verified: false }),
    });

    await assert.rejects(
      client.exchangeCode("authorization-code"),
      InvalidGoogleAuthenticationError,
    );
  });

  test("maps provider exchange failures to a generic auth error", async () => {
    const diagnostics: GoogleOAuthFailureDetails[] = [];
    const client = createGoogleOAuthClient(
      config,
      {
        ...createSdk(),
        getToken: async () => {
          throw new Error("invalid_grant from Google");
        },
      },
      { providerUnavailable: (details) => diagnostics.push(details) },
    );

    await assert.rejects(client.exchangeCode("expired-code"), {
      message: "Google authentication failed",
      statusCode: 401,
    });
    assert.deepEqual(diagnostics, []);
  });

  test("reports sanitized network outages separately", async () => {
    const diagnostics: GoogleOAuthFailureDetails[] = [];
    const networkError = Object.assign(new Error("request timed out"), {
      code: "ETIMEDOUT",
    });
    const client = createGoogleOAuthClient(
      config,
      {
        ...createSdk(),
        getToken: async () => {
          throw networkError;
        },
      },
      { providerUnavailable: (details) => diagnostics.push(details) },
    );

    await assert.rejects(
      client.exchangeCode("authorization-code"),
      GoogleProviderUnavailableError,
    );
    assert.deepEqual(diagnostics, [
      { operation: "code_exchange", networkCode: "ETIMEDOUT" },
    ]);
  });

  test("reports Google service failures during ID-token verification", async () => {
    const diagnostics: GoogleOAuthFailureDetails[] = [];
    const client = createGoogleOAuthClient(
      config,
      {
        ...createSdk(),
        verifyIdToken: async () => {
          throw Object.assign(new Error("Google unavailable"), {
            response: { status: 503 },
          });
        },
      },
      { providerUnavailable: (details) => diagnostics.push(details) },
    );

    await assert.rejects(
      client.exchangeCode("authorization-code"),
      GoogleProviderUnavailableError,
    );
    assert.deepEqual(diagnostics, [
      { operation: "id_token_verification", responseStatus: 503 },
    ]);
  });
});

describe("OAuth state manager", () => {
  test("creates 32-byte opaque states and verifies exact matches", () => {
    const states = createOAuthStateManager();
    const state = states.create();

    assert.equal(Buffer.from(state, "base64url").byteLength, 32);
    assert.equal(states.verify(state, state), true);
    assert.equal(states.verify(`${state}x`, state), false);
    assert.equal(states.verify("different-state", state), false);
  });
});
