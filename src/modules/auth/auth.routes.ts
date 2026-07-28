import express from "express";
import { rateLimit } from "express-rate-limit";

import TooManyRequestsError from "../../errors/TooManyRequestsError.js";
import type { AuthController } from "./auth.controller.js";
import type { AuthMiddleware } from "./auth.middleware.js";
import { loginSchema, registerSchema } from "./auth.schemas.js";
import { validateBody } from "./auth.middleware.js";

const createLimiter = (
  windowMs: number,
  limit: number,
  message: string,
  skipSuccessfulRequests = false,
) =>
  rateLimit({
    windowMs,
    limit,
    standardHeaders: "draft-8",
    legacyHeaders: false,
    skipSuccessfulRequests,
    handler(_req, _res, next) {
      next(new TooManyRequestsError(message));
    },
  });

export interface AuthRouterOptions {
  rateLimitsEnabled?: boolean;
}

const createAuthRouter = (
  controller: AuthController,
  middleware: AuthMiddleware,
  { rateLimitsEnabled = true }: AuthRouterOptions = {},
) => {
  const router = express.Router();
  const noLimit = express.Router();
  const registerLimit = rateLimitsEnabled
    ? createLimiter(60 * 60 * 1000, 5, "Too many registration attempts")
    : noLimit;
  const loginLimit = rateLimitsEnabled
    ? createLimiter(15 * 60 * 1000, 10, "Too many failed login attempts", true)
    : noLimit;
  const refreshLimit = rateLimitsEnabled
    ? createLimiter(15 * 60 * 1000, 60, "Too many refresh attempts")
    : noLimit;

  router.post(
    "/register",
    registerLimit,
    validateBody(registerSchema),
    controller.register,
  );
  router.post(
    "/login",
    loginLimit,
    validateBody(loginSchema),
    controller.login,
  );
  router.post(
    "/refresh",
    refreshLimit,
    middleware.requireRefreshCsrfProtection,
    middleware.requireRefreshCookie,
    controller.refresh,
  );
  router.get("/me", middleware.requireAccessToken, controller.me);

  return router;
};

export default createAuthRouter;
