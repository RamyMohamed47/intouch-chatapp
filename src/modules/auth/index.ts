import createMongooseUserRepository from "../user/user.repository.js";
import createAuthController from "./auth.controller.js";
import createAuthMiddleware from "./auth.middleware.js";
import createMongooseAuthSessionRepository from "./auth.repository.js";
import createAuthRouter from "./auth.routes.js";
import createAuthService from "./auth.service.js";
import {
  createBcryptPasswordHasher,
  createJwtAccessTokenManager,
  createRefreshTokenManager,
} from "./auth.tokens.js";
import type { AuthCookieConfig } from "./auth.types.js";

export interface AuthModuleConfig {
  accessTokenSecret: string;
  accessTokenIssuer: string;
  accessTokenAudience: string;
  allowedOrigins: readonly string[];
  cookie: AuthCookieConfig;
  rateLimitsEnabled?: boolean;
}

const createAuthModule = (config: AuthModuleConfig) => {
  const users = createMongooseUserRepository();
  const sessions = createMongooseAuthSessionRepository();
  const passwords = createBcryptPasswordHasher();
  const accessTokens = createJwtAccessTokenManager({
    secret: config.accessTokenSecret,
    issuer: config.accessTokenIssuer,
    audience: config.accessTokenAudience,
  });
  const refreshTokens = createRefreshTokenManager();
  const service = createAuthService({
    users,
    sessions,
    passwords,
    accessTokens,
    refreshTokens,
  });
  const controller = createAuthController(service, config.cookie);
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

  return { router };
};

export default createAuthModule;

export { default as createAuthController } from "./auth.controller.js";
export { default as createAuthMiddleware } from "./auth.middleware.js";
export { default as createAuthRouter } from "./auth.routes.js";
export { default as createAuthService } from "./auth.service.js";
export {
  createBcryptPasswordHasher,
  createJwtAccessTokenManager,
  createRefreshTokenManager,
} from "./auth.tokens.js";
export type { AuthController } from "./auth.controller.js";
export type { AuthMiddleware } from "./auth.middleware.js";
export type { AuthService } from "./auth.service.js";
