import { createHmac } from "node:crypto";

import { LoginAttemptsExceededError } from "./auth.errors.js";
import type { LoginAttemptRepository } from "./auth.login-attempt.repository.js";

export interface LoginProtectionPolicy {
  attemptLimit: number;
  windowMs: number;
  cooldownMs: number;
  hashSecret: string;
}

export interface LoginProtectionObserver {
  throttled(details: {
    identifierHash: string;
    attemptCount: number;
    blockedUntil?: Date;
  }): void;
}

export interface LoginProtectionServiceDependencies {
  attempts: LoginAttemptRepository;
  policy: LoginProtectionPolicy;
  now?: () => Date;
  observer?: LoginProtectionObserver;
}

const normalizeIdentifier = (email: string) => email.trim().toLowerCase();

export const createLoginIdentifierHash = (email: string, secret: string) =>
  createHmac("sha256", secret).update(normalizeIdentifier(email)).digest("hex");

const createLoginProtectionService = ({
  attempts,
  policy,
  now = () => new Date(),
  observer,
}: LoginProtectionServiceDependencies) => {
  const getIdentifierHash = (email: string) =>
    createLoginIdentifierHash(email, policy.hashSecret);

  return {
    async reserveAttempt(email: string): Promise<void> {
      const identifierHash = getIdentifierHash(email);
      const reservation = await attempts.reserve({
        identifierHash,
        limit: policy.attemptLimit,
        windowMs: policy.windowMs,
        cooldownMs: policy.cooldownMs,
        now: now(),
      });

      if (reservation.allowed) return;

      observer?.throttled({
        identifierHash,
        attemptCount: reservation.attemptCount,
        ...(reservation.blockedUntil
          ? { blockedUntil: reservation.blockedUntil }
          : {}),
      });
      throw new LoginAttemptsExceededError();
    },

    async clearAttempts(email: string): Promise<void> {
      await attempts.clear(getIdentifierHash(email));
    },
  };
};

export type LoginProtectionService = ReturnType<
  typeof createLoginProtectionService
>;

export default createLoginProtectionService;
