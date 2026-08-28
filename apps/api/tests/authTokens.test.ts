import assert from "node:assert/strict";
import { describe, test } from "node:test";

import { createJwtAccessTokenManager } from "../src/modules/auth/auth.access-token.js";
import { createBcryptPasswordHasher } from "../src/modules/auth/auth.password.js";
import { createRefreshTokenManager } from "../src/modules/auth/auth.refresh-token.js";
import { createAuthActionTokenManager } from "../src/modules/auth/auth.action-token.js";

describe("auth token primitives", () => {
  test("hashes and verifies passwords without retaining plaintext", async () => {
    const passwords = createBcryptPasswordHasher();
    const password = "correct horse battery staple";
    const hash = await passwords.hash(password);

    assert.notEqual(hash, password);
    assert.equal(await passwords.compare(password, hash), true);
    assert.equal(await passwords.compare("incorrect", hash), false);
    assert.equal(await passwords.compareDummy(password), false);
  });

  test("signs and verifies access-token claims", async () => {
    const tokens = createJwtAccessTokenManager({
      secret: "test-secret-that-is-at-least-32-bytes-long",
      issuer: "intouch-api",
      audience: "intouch-client",
    });
    const token = await tokens.sign("user-1");

    assert.deepEqual(await tokens.verify(token), { userId: "user-1" });
  });

  test("rejects access tokens signed for another audience", async () => {
    const signer = createJwtAccessTokenManager({
      secret: "test-secret-that-is-at-least-32-bytes-long",
      issuer: "intouch-api",
      audience: "another-client",
    });
    const verifier = createJwtAccessTokenManager({
      secret: "test-secret-that-is-at-least-32-bytes-long",
      issuer: "intouch-api",
      audience: "intouch-client",
    });

    await assert.rejects(verifier.verify(await signer.sign("user-1")), {
      statusCode: 401,
    });
  });

  test("creates opaque refresh tokens and stable hashes", () => {
    const tokens = createRefreshTokenManager();
    const created = tokens.create();

    assert.deepEqual(tokens.parse(created.token), {
      sessionId: created.sessionId,
    });
    assert.equal(tokens.hash(created.token), tokens.hash(created.token));
    assert.equal(tokens.parse("malformed"), null);
  });

  test("creates parseable action tokens without storing their secret", () => {
    const tokens = createAuthActionTokenManager(
      "test-action-token-secret-that-is-at-least-32-bytes",
    );
    const created = tokens.create();
    const parsed = tokens.parse(created.token);

    assert.ok(parsed);
    assert.equal(parsed.id, created.id);
    assert.equal(parsed.secretHash, created.secretHash);
    assert.equal(created.secretHash.includes(created.token), false);
    assert.equal(tokens.parse(`${created.token}.extra`), null);
    assert.equal(tokens.parse("malformed"), null);
  });
});
