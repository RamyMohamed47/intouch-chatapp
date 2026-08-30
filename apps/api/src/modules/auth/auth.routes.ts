import express from "express";
import { rateLimit } from "express-rate-limit";
import type { Store } from "express-rate-limit";

import TooManyRequestsError from "../../errors/TooManyRequestsError.js";
import type { AuthController } from "./auth.controller.js";
import type { AuthMiddleware } from "./auth.middleware.js";
import {
  forgotPasswordSchema,
  loginSchema,
  registerSchema,
  resendVerificationSchema,
  resetPasswordSchema,
  verifyEmailSchema,
} from "./auth.schemas.js";
import { validateBody } from "../../middleware/validateRequest.js";

const createLimiter = (
  windowMs: number,
  limit: number,
  message: string,
  skipSuccessfulRequests = false,
  store?: Store,
) =>
  rateLimit({
    windowMs,
    limit,
    standardHeaders: "draft-8",
    legacyHeaders: false,
    skipSuccessfulRequests,
    ...(store ? { store } : {}),
    handler(_req, _res, next) {
      next(new TooManyRequestsError(message));
    },
  });

export interface AuthRouterOptions {
  rateLimitsEnabled?: boolean;
  rateLimitStoreFactory?: (prefix: string) => Store;
}

const createAuthRouter = (
  controller: AuthController,
  middleware: AuthMiddleware,
  { rateLimitsEnabled = true, rateLimitStoreFactory }: AuthRouterOptions = {},
) => {
  const router = express.Router();
  const noLimit = express.Router();
  const registerLimit = rateLimitsEnabled
    ? createLimiter(
        60 * 60 * 1000,
        5,
        "Too many registration attempts",
        false,
        rateLimitStoreFactory?.("register"),
      )
    : noLimit;
  const loginLimit = rateLimitsEnabled
    ? createLimiter(
        15 * 60 * 1000,
        10,
        "Too many failed login attempts",
        true,
        rateLimitStoreFactory?.("login"),
      )
    : noLimit;
  const refreshLimit = rateLimitsEnabled
    ? createLimiter(
        15 * 60 * 1000,
        60,
        "Too many refresh attempts",
        false,
        rateLimitStoreFactory?.("refresh"),
      )
    : noLimit;
  const googleStartLimit = rateLimitsEnabled
    ? createLimiter(
        15 * 60 * 1000,
        10,
        "Too many Google login attempts",
        false,
        rateLimitStoreFactory?.("google-start"),
      )
    : noLimit;
  const googleCallbackLimit = rateLimitsEnabled
    ? createLimiter(
        15 * 60 * 1000,
        20,
        "Too many Google callback attempts",
        false,
        rateLimitStoreFactory?.("google-callback"),
      )
    : noLimit;
  const emailRequestLimit = rateLimitsEnabled
    ? createLimiter(
        15 * 60 * 1000,
        5,
        "Too many email requests",
        false,
        rateLimitStoreFactory?.("email-request"),
      )
    : noLimit;
  const tokenActionLimit = rateLimitsEnabled
    ? createLimiter(
        15 * 60 * 1000,
        20,
        "Too many authentication attempts",
        false,
        rateLimitStoreFactory?.("token-action"),
      )
    : noLimit;

  router.get("/oauth/google", googleStartLimit, controller.googleStart);
  router.get(
    "/oauth/google/callback",
    googleCallbackLimit,
    controller.googleCallback,
  );

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
    "/verify-email",
    tokenActionLimit,
    validateBody(verifyEmailSchema),
    controller.verifyEmail,
  );
  router.post(
    "/resend-verification",
    emailRequestLimit,
    validateBody(resendVerificationSchema),
    controller.resendVerification,
  );
  router.post(
    "/forgot-password",
    emailRequestLimit,
    validateBody(forgotPasswordSchema),
    controller.forgotPassword,
  );
  router.post(
    "/reset-password",
    tokenActionLimit,
    validateBody(resetPasswordSchema),
    controller.resetPassword,
  );
  router.post(
    "/refresh",
    refreshLimit,
    middleware.requireRefreshCsrfProtection,
    middleware.requireRefreshCookie,
    controller.refresh,
  );
  router.post(
    "/logout",
    refreshLimit,
    middleware.requireRefreshCsrfProtection,
    controller.logout,
  );
  router.get("/me", middleware.requireAccessToken, controller.me);

  return router;
};

export default createAuthRouter;
