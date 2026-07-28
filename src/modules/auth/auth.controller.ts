import type { RequestHandler, Response } from "express";

import catchAsync from "../../utils/catchAsync.js";
import type { LoginInput, RegisterInput } from "./auth.schemas.js";
import type { AuthService } from "./auth.service.js";
import type { AuthCookieConfig, AuthLocals } from "./auth.types.js";

export interface AuthController {
  register: RequestHandler;
  login: RequestHandler;
  refresh: RequestHandler;
  me: RequestHandler;
}

const getCookieOptions = (cookie: AuthCookieConfig) => ({
  httpOnly: true,
  secure: cookie.secure,
  sameSite: "lax" as const,
  path: "/api/v1/auth",
  maxAge: cookie.maxAgeMs,
});

const setRefreshCookie = (
  res: Response,
  cookie: AuthCookieConfig,
  refreshToken: string,
) => {
  res.cookie(cookie.name, refreshToken, getCookieOptions(cookie));
};

const clearRefreshCookie = (res: Response, cookie: AuthCookieConfig) => {
  res.clearCookie(cookie.name, {
    httpOnly: true,
    secure: cookie.secure,
    sameSite: "lax",
    path: "/api/v1/auth",
  });
};

const createAuthController = (
  authService: AuthService,
  cookie: AuthCookieConfig,
): AuthController => ({
  register: catchAsync(async (req, res) => {
    const result = await authService.register(req.body as RegisterInput);

    setRefreshCookie(res, cookie, result.refreshToken);
    res.status(201).json({
      user: result.user,
      accessToken: result.accessToken,
    });
  }),

  login: catchAsync(async (req, res) => {
    const result = await authService.login(req.body as LoginInput);

    setRefreshCookie(res, cookie, result.refreshToken);
    res.status(200).json({
      user: result.user,
      accessToken: result.accessToken,
    });
  }),

  refresh: catchAsync(async (_req, res) => {
    const refreshToken = (res.locals as AuthLocals).refreshToken;

    if (!refreshToken) {
      clearRefreshCookie(res, cookie);
      throw new Error("Refresh middleware did not provide a token");
    }

    try {
      const result = await authService.refresh(refreshToken);

      setRefreshCookie(res, cookie, result.refreshToken);
      res.status(200).json({ accessToken: result.accessToken });
    } catch (error) {
      clearRefreshCookie(res, cookie);
      throw error;
    }
  }),

  me: catchAsync(async (_req, res) => {
    const userId = (res.locals as AuthLocals).userId;

    if (!userId) {
      throw new Error("Authentication middleware did not provide a user ID");
    }

    const user = await authService.getCurrentUser(userId);
    res.status(200).json({ user });
  }),
});

export default createAuthController;
