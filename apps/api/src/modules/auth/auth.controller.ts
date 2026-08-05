import type { RequestHandler, Response } from "express";
import {
  authResponseSchema,
  googleOAuthCallbackQuerySchema,
  refreshResponseSchema,
} from "@intouch/shared/auth";
import { userResponseSchema } from "@intouch/shared/users";

import catchAsync from "../../utils/catchAsync.js";
import {
  GoogleIdentityConflictError,
  GoogleProviderUnavailableError,
  InvalidGoogleAuthenticationError,
} from "./auth.errors.js";
import type { LoginInput, RegisterInput } from "./auth.schemas.js";
import type { AuthService } from "./auth.service.js";
import type {
  AuthCookieConfig,
  AuthLocals,
  OAuthStateManager,
} from "./auth.types.js";

const GOOGLE_OAUTH_PATH = "/api/v1/auth/oauth/google";

export interface AuthController {
  googleCallback: RequestHandler;
  googleStart: RequestHandler;
  register: RequestHandler;
  login: RequestHandler;
  refresh: RequestHandler;
  me: RequestHandler;
}

export interface GoogleOAuthControllerConfig {
  frontendRedirectUrl: string;
  stateCookie: AuthCookieConfig;
  states: OAuthStateManager;
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

const getStateCookieOptions = (cookie: AuthCookieConfig) => ({
  httpOnly: true,
  secure: cookie.secure,
  sameSite: "lax" as const,
  path: GOOGLE_OAUTH_PATH,
  maxAge: cookie.maxAgeMs,
});

const clearStateCookie = (res: Response, cookie: AuthCookieConfig) => {
  res.clearCookie(cookie.name, {
    httpOnly: true,
    secure: cookie.secure,
    sameSite: "lax",
    path: GOOGLE_OAUTH_PATH,
  });
};

const getCookie = (cookies: unknown, name: string) => {
  if (typeof cookies !== "object" || cookies === null) {
    return undefined;
  }

  const value = (cookies as Record<PropertyKey, unknown>)[name];
  return typeof value === "string" ? value : undefined;
};

const getFrontendRedirect = (
  frontendRedirectUrl: string,
  status: "failed" | "success",
) => {
  const url = new URL(frontendRedirectUrl);
  url.searchParams.set("googleAuth", status);
  return url.toString();
};

const isExpectedGoogleFailure = (error: unknown) =>
  error instanceof InvalidGoogleAuthenticationError ||
  error instanceof GoogleIdentityConflictError ||
  error instanceof GoogleProviderUnavailableError;

const createAuthController = (
  authService: AuthService,
  cookie: AuthCookieConfig,
  googleOAuth: GoogleOAuthControllerConfig,
): AuthController => ({
  googleStart: (_req, res) => {
    const state = googleOAuth.states.create();
    const authorizationUrl = authService.getGoogleAuthorizationUrl(state);

    res.cookie(
      googleOAuth.stateCookie.name,
      state,
      getStateCookieOptions(googleOAuth.stateCookie),
    );
    res.redirect(302, authorizationUrl);
  },

  googleCallback: catchAsync(async (req, res) => {
    const query = googleOAuthCallbackQuerySchema.safeParse(req.query);
    const receivedState = query.success ? query.data.state : undefined;
    const expectedState = getCookie(
      req.cookies as unknown,
      googleOAuth.stateCookie.name,
    );
    const code = query.success ? query.data.code : undefined;
    const providerError = query.success ? query.data.error : undefined;
    const failureRedirect = getFrontendRedirect(
      googleOAuth.frontendRedirectUrl,
      "failed",
    );

    clearStateCookie(res, googleOAuth.stateCookie);

    if (
      providerError ||
      !receivedState ||
      !expectedState ||
      !googleOAuth.states.verify(receivedState, expectedState) ||
      !code
    ) {
      res.redirect(302, failureRedirect);
      return;
    }

    try {
      const result = await authService.loginWithGoogle(code);

      setRefreshCookie(res, cookie, result.refreshToken);
      res.redirect(
        302,
        getFrontendRedirect(googleOAuth.frontendRedirectUrl, "success"),
      );
    } catch (error) {
      if (isExpectedGoogleFailure(error)) {
        res.redirect(302, failureRedirect);
        return;
      }

      throw error;
    }
  }),

  register: catchAsync(async (req, res) => {
    const result = await authService.register(req.body as RegisterInput);

    setRefreshCookie(res, cookie, result.refreshToken);
    res.status(201).json(authResponseSchema.parse(result));
  }),

  login: catchAsync(async (req, res) => {
    const result = await authService.login(req.body as LoginInput);

    setRefreshCookie(res, cookie, result.refreshToken);
    res.status(200).json(authResponseSchema.parse(result));
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
      res.status(200).json(refreshResponseSchema.parse(result));
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
    res.status(200).json(userResponseSchema.parse({ user }));
  }),
});

export default createAuthController;
