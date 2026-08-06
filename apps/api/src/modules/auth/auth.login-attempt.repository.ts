import type { PipelineStage } from "mongoose";

import {
  LoginAttemptModel,
  type LoginAttempt,
} from "./auth.login-attempt.model.js";

const MAX_RESERVATION_RETRIES = 3;

export interface ReserveLoginAttemptInput {
  identifierHash: string;
  limit: number;
  windowMs: number;
  cooldownMs: number;
  now: Date;
}

export interface LoginAttemptReservation {
  allowed: boolean;
  attemptCount: number;
  blockedUntil?: Date;
}

export interface LoginAttemptRepository {
  reserve(input: ReserveLoginAttemptInput): Promise<LoginAttemptReservation>;
  clear(identifierHash: string): Promise<void>;
}

const isDuplicateKeyError = (error: unknown) =>
  typeof error === "object" &&
  error !== null &&
  "code" in error &&
  error.code === 11000;

const toReservation = (
  attempt: LoginAttempt,
  allowed: boolean,
): LoginAttemptReservation => ({
  allowed,
  attemptCount: attempt.attemptCount,
  ...(attempt.blockedUntil ? { blockedUntil: attempt.blockedUntil } : {}),
});

const isBlocked = (attempt: LoginAttempt, now: Date, limit: number) =>
  attempt.expiresAt > now &&
  ((attempt.blockedUntil !== undefined && attempt.blockedUntil > now) ||
    attempt.attemptCount >= limit);

const createReservationPipeline = (
  input: ReserveLoginAttemptInput,
): PipelineStage[] => {
  const windowEnd = new Date(input.now.getTime() + input.windowMs);
  const cooldownEnd = new Date(input.now.getTime() + input.cooldownMs);
  const windowIsActive = { $gt: ["$expiresAt", input.now] };
  const nextAttemptCount = {
    $cond: [windowIsActive, { $add: ["$attemptCount", 1] }, 1],
  };
  const reachesLimit = { $gte: [nextAttemptCount, input.limit] };

  return [
    {
      $set: {
        attemptCount: nextAttemptCount,
        windowStartedAt: {
          $cond: [windowIsActive, "$windowStartedAt", input.now],
        },
        blockedUntil: {
          $cond: [reachesLimit, cooldownEnd, "$$REMOVE"],
        },
        expiresAt: {
          $cond: [
            reachesLimit,
            cooldownEnd,
            { $cond: [windowIsActive, "$expiresAt", windowEnd] },
          ],
        },
      },
    },
  ];
};

const createMongooseLoginAttemptRepository = (): LoginAttemptRepository => ({
  async reserve(input) {
    for (let retry = 0; retry < MAX_RESERVATION_RETRIES; retry += 1) {
      const updated = await LoginAttemptModel.findOneAndUpdate(
        {
          identifierHash: input.identifierHash,
          $or: [
            { expiresAt: { $lte: input.now } },
            {
              expiresAt: { $gt: input.now },
              attemptCount: { $lt: input.limit },
              $or: [
                { blockedUntil: { $exists: false } },
                { blockedUntil: { $lte: input.now } },
              ],
            },
          ],
        },
        createReservationPipeline(input),
        { new: true },
      )
        .lean<LoginAttempt>()
        .exec();

      if (updated) {
        return toReservation(updated, true);
      }

      const blockedUntil =
        input.limit === 1
          ? new Date(input.now.getTime() + input.cooldownMs)
          : undefined;
      const expiresAt =
        blockedUntil ?? new Date(input.now.getTime() + input.windowMs);

      try {
        const created = await LoginAttemptModel.create({
          identifierHash: input.identifierHash,
          attemptCount: 1,
          windowStartedAt: input.now,
          ...(blockedUntil ? { blockedUntil } : {}),
          expiresAt,
        });

        return toReservation(created.toObject<LoginAttempt>(), true);
      } catch (error) {
        if (!isDuplicateKeyError(error)) {
          throw error;
        }

        const current = await LoginAttemptModel.findOne({
          identifierHash: input.identifierHash,
        })
          .lean<LoginAttempt>()
          .exec();

        if (current && isBlocked(current, input.now, input.limit)) {
          return toReservation(current, false);
        }
      }
    }

    throw new Error("Could not reserve login attempt after concurrent updates");
  },

  async clear(identifierHash) {
    await LoginAttemptModel.deleteOne({ identifierHash }).exec();
  },
});

export default createMongooseLoginAttemptRepository;
