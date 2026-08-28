import { createHmac } from "node:crypto";

import TooManyRequestsError from "../../errors/TooManyRequestsError.js";
import type { LoginAttemptRepository } from "./auth.login-attempt.repository.js";

const WINDOW_MS = 60 * 60 * 1000;
const ATTEMPT_LIMIT = 3;

export type AuthMailPurpose = "PASSWORD_RESET" | "VERIFICATION";

export interface AuthMailProtectionService {
  reserve(email: string, purpose: AuthMailPurpose): Promise<void>;
}

const createAuthMailProtectionService = (dependencies: {
  attempts: LoginAttemptRepository;
  hashSecret: string;
  now?: () => Date;
  throttled?: (details: {
    identifierHash: string;
    purpose: AuthMailPurpose;
  }) => void;
}): AuthMailProtectionService => ({
  async reserve(email, purpose) {
    const identifierHash = createHmac("sha256", dependencies.hashSecret)
      .update(`mail:${purpose}:${email}`, "utf8")
      .digest("hex");
    const reservation = await dependencies.attempts.reserve({
      identifierHash,
      limit: ATTEMPT_LIMIT,
      windowMs: WINDOW_MS,
      cooldownMs: WINDOW_MS,
      now: dependencies.now?.() ?? new Date(),
    });
    if (!reservation.allowed) {
      dependencies.throttled?.({ identifierHash, purpose });
      throw new TooManyRequestsError("Too many email requests");
    }
  },
});

export default createAuthMailProtectionService;
