import { randomBytes, timingSafeEqual } from "node:crypto";

import type { OAuthStateManager } from "./auth.types.js";

export const createOAuthStateManager = (): OAuthStateManager => ({
  create: () => randomBytes(32).toString("base64url"),

  verify(receivedState, expectedState) {
    const received = Buffer.from(receivedState);
    const expected = Buffer.from(expectedState);

    return (
      received.length === expected.length && timingSafeEqual(received, expected)
    );
  },
});
