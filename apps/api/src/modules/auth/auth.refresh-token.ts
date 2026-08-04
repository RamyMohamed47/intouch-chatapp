import { createHash, randomBytes, randomUUID } from "node:crypto";

import type { RefreshTokenManager } from "./auth.types.js";

export const createRefreshTokenManager = (): RefreshTokenManager => ({
  create(sessionId = randomUUID()) {
    const secret = randomBytes(32).toString("base64url");

    return {
      sessionId,
      token: `${sessionId}.${secret}`,
    };
  },

  parse(token) {
    const [sessionId, secret, extra] = token.split(".");

    if (
      extra !== undefined ||
      !sessionId ||
      !secret ||
      !/^[0-9a-f-]{36}$/i.test(sessionId) ||
      !/^[A-Za-z0-9_-]{43}$/.test(secret)
    ) {
      return null;
    }

    return { sessionId };
  },

  hash(token) {
    return createHash("sha256").update(token).digest("hex");
  },
});
