import type { RequestHandler } from "express";

import ForbiddenError from "../../errors/ForbiddenError.js";
import UnauthorizedError from "../../errors/UnauthorizedError.js";
import { refreshSchema } from "./auth.schemas.js";
import type {
  AccessTokenManager,
  AuthCookieConfig,
  AuthLocals,
} from "./auth.types.js";

const getCookie = (cookies: unknown, name: string) => {
  if (typeof cookies !== "object" || cookies === null) {
    return undefined;
  }

  const value = (cookies as Record<PropertyKey, unknown>)[name];
  return typeof value === "string" ? value : undefined;
};

export interface AuthMiddlewareDependencies {
  accessTokens: AccessTokenManager;
  cookie: AuthCookieConfig;
  allowedOrigins: readonly string[];
}

const createAuthMiddleware = ({
  accessTokens,
  cookie,
  allowedOrigins,
}: AuthMiddlewareDependencies) => {
  const allowedOriginSet = new Set(allowedOrigins);

  const requireRefreshCookie: RequestHandler = (req, res, next) => {
    const result = refreshSchema.safeParse({
      refreshToken: getCookie(req.cookies, cookie.name),
    });

    if (!result.success) {
      next(new UnauthorizedError("Refresh token is required"));
      return;
    }

    (res.locals as AuthLocals).refreshToken = result.data.refreshToken;
    next();
  };

  const requireRefreshCsrfProtection: RequestHandler = (req, _res, next) => {
    const origin = req.get("origin");
    const csrfHeader = req.get("x-csrf-protection");

    if (!origin || !allowedOriginSet.has(origin) || csrfHeader !== "1") {
      next(new ForbiddenError("Refresh request failed CSRF validation"));
      return;
    }

    next();
  };

  const requireAccessToken: RequestHandler = (req, res, next) => {
    const authorization = req.get("authorization");
    const match = /^Bearer ([^\s]+)$/.exec(authorization ?? "");

    if (!match?.[1]) {
      next(new UnauthorizedError("Bearer access token is required"));
      return;
    }

    void accessTokens
      .verify(match[1])
      .then(({ userId }) => {
        (res.locals as AuthLocals).userId = userId;
        next();
      })
      .catch(next);
  };

  return {
    requireAccessToken,
    requireRefreshCookie,
    requireRefreshCsrfProtection,
  };
};

export type AuthMiddleware = ReturnType<typeof createAuthMiddleware>;

export default createAuthMiddleware;
