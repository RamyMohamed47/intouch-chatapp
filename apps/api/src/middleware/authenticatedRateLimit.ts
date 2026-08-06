import type { RequestHandler } from "express";

import TooManyRequestsError from "../errors/TooManyRequestsError.js";
import UnauthorizedError from "../errors/UnauthorizedError.js";
import type {
  AuthenticatedRateLimiter,
  RateLimitAction,
} from "../modules/abuse-protection/index.js";

const createAuthenticatedRateLimit =
  (
    rateLimits: AuthenticatedRateLimiter,
    action: RateLimitAction,
    message: string,
  ): RequestHandler =>
  (_req, res, next) => {
    const userId = (res.locals as { userId?: unknown }).userId;
    if (typeof userId !== "string") {
      next(new UnauthorizedError());
      return;
    }

    void rateLimits
      .consume(userId, action)
      .then((decision) => {
        if (decision.allowed) {
          next();
          return;
        }
        res.set("Retry-After", String(Math.ceil(decision.retryAfterMs / 1000)));
        next(new TooManyRequestsError(message));
      })
      .catch(next);
  };

export default createAuthenticatedRateLimit;
