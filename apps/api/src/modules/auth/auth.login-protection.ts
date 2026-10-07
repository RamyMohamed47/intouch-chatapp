import { createHmac } from "node:crypto";

import { ipKeyGenerator } from "express-rate-limit";

import { LoginAttemptsExceededError } from "./auth.errors.js";
import type { LoginAttemptRepository } from "./auth.login-attempt.repository.js";

export interface LoginProtectionPolicy {
  attemptLimit: number;
  accountAttemptLimit: number;
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

export const createLoginClientIdentifierHash = (
  email: string,
  clientIp: string,
  secret: string,
) =>
  createHmac("sha256", secret)
    .update(`client:${ipKeyGenerator(clientIp)}:${normalizeIdentifier(email)}`)
    .digest("hex");

const createLoginProtectionService = ({
  attempts,
  policy,
  now = () => new Date(),
  observer,
}: LoginProtectionServiceDependencies) => {
  const reserve = async (identifierHash: string, limit: number) => {
    const reservation = await attempts.reserve({
      identifierHash,
      limit,
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
  };

  return {
    /**
     * A known client is limited per account and address so one address cannot
     * lock an account for everyone; the account-wide ceiling still bounds
     * guessing spread across many addresses.
     */
    async reserveAttempt(email: string, clientIp?: string): Promise<void> {
      const accountHash = createLoginIdentifierHash(email, policy.hashSecret);

      if (!clientIp) {
        await reserve(accountHash, policy.attemptLimit);
        return;
      }

      await reserve(
        createLoginClientIdentifierHash(email, clientIp, policy.hashSecret),
        policy.attemptLimit,
      );
      await reserve(accountHash, policy.accountAttemptLimit);
    },

    async clearAttempts(email: string, clientIp?: string): Promise<void> {
      await attempts.clear(createLoginIdentifierHash(email, policy.hashSecret));
      if (clientIp) {
        await attempts.clear(
          createLoginClientIdentifierHash(email, clientIp, policy.hashSecret),
        );
      }
    },
  };
};

export type LoginProtectionService = ReturnType<
  typeof createLoginProtectionService
>;

export default createLoginProtectionService;
