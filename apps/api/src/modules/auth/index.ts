import { getLogger } from "../../config/logger.js";
import createMongooseUserRepository from "../user/user.repository.js";
import { createJwtAccessTokenManager } from "./auth.access-token.js";
import createAuthController from "./auth.controller.js";
import { createGoogleOAuthClient } from "./auth.google.js";
import createAuthMiddleware from "./auth.middleware.js";
import { createOAuthStateManager } from "./auth.oauth-state.js";
import { createBcryptPasswordHasher } from "./auth.password.js";
import { createRefreshTokenManager } from "./auth.refresh-token.js";
import createMongooseAuthSessionRepository from "./auth.repository.js";
import createMongooseLoginAttemptRepository from "./auth.login-attempt.repository.js";
import createLoginProtectionService from "./auth.login-protection.js";
import createAuthRouter from "./auth.routes.js";
import createAuthService from "./auth.service.js";
import createMongooseAuthUnitOfWork from "./auth.unit-of-work.js";
import type { AuthCookieConfig } from "./auth.types.js";

export interface AuthModuleConfig {
  accessTokenSecret: string;
  accessTokenIssuer: string;
  accessTokenAudience: string;
  allowedOrigins: readonly string[];
  cookie: AuthCookieConfig;
  googleOAuth: {
    callbackUrl: string;
    clientId: string;
    clientSecret: string;
    frontendRedirectUrl: string;
    stateCookie: AuthCookieConfig;
  };
  loginProtection: {
    attemptLimit: number;
    cooldownMs: number;
    hashSecret: string;
    windowMs: number;
  };
  rateLimitsEnabled?: boolean;
}

const createAuthModule = (config: AuthModuleConfig) => {
  const logger = getLogger();
  const users = createMongooseUserRepository();
  const sessions = createMongooseAuthSessionRepository();
  const loginAttempts = createMongooseLoginAttemptRepository();
  const unitOfWork = createMongooseAuthUnitOfWork();
  const passwords = createBcryptPasswordHasher();
  const accessTokens = createJwtAccessTokenManager({
    secret: config.accessTokenSecret,
    issuer: config.accessTokenIssuer,
    audience: config.accessTokenAudience,
  });
  const refreshTokens = createRefreshTokenManager();
  const googleOAuth = createGoogleOAuthClient(config.googleOAuth, undefined, {
    providerUnavailable(details) {
      logger.error(
        { provider: "google", ...details },
        "OAuth provider unavailable",
      );
    },
  });
  const oauthStates = createOAuthStateManager();
  const loginProtection = createLoginProtectionService({
    attempts: loginAttempts,
    policy: config.loginProtection,
    observer: {
      throttled(details) {
        logger.warn(
          { securityEvent: "auth.login.throttled", ...details },
          "Account login attempts throttled",
        );
      },
    },
  });
  const service = createAuthService({
    users,
    sessions,
    passwords,
    accessTokens,
    googleOAuth,
    loginProtection,
    refreshTokens,
    unitOfWork,
  });
  const controller = createAuthController(service, config.cookie, {
    frontendRedirectUrl: config.googleOAuth.frontendRedirectUrl,
    stateCookie: config.googleOAuth.stateCookie,
    states: oauthStates,
  });
  const middleware = createAuthMiddleware({
    accessTokens,
    cookie: config.cookie,
    allowedOrigins: config.allowedOrigins,
  });
  const router = createAuthRouter(controller, middleware, {
    ...(config.rateLimitsEnabled === undefined
      ? {}
      : { rateLimitsEnabled: config.rateLimitsEnabled }),
  });

  return {
    accessTokens,
    requireAccessToken: middleware.requireAccessToken,
    router,
  };
};

export default createAuthModule;

export { default as createAuthController } from "./auth.controller.js";
export { default as createAuthMiddleware } from "./auth.middleware.js";
export { default as createAuthRouter } from "./auth.routes.js";
export { default as createAuthService } from "./auth.service.js";
export { createJwtAccessTokenManager } from "./auth.access-token.js";
export { createBcryptPasswordHasher } from "./auth.password.js";
export { createGoogleOAuthClient } from "./auth.google.js";
export { createOAuthStateManager } from "./auth.oauth-state.js";
export { createRefreshTokenManager } from "./auth.refresh-token.js";
export { default as createLoginProtectionService } from "./auth.login-protection.js";
export { default as createMongooseLoginAttemptRepository } from "./auth.login-attempt.repository.js";
export { default as createMongooseAuthUnitOfWork } from "./auth.unit-of-work.js";
export type { AuthController } from "./auth.controller.js";
export type { AuthMiddleware } from "./auth.middleware.js";
export type { AuthService } from "./auth.service.js";
export type { AuthUnitOfWork } from "./auth.unit-of-work.js";
export type { LoginProtectionService } from "./auth.login-protection.js";
