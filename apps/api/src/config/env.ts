import dotenv from "dotenv";
import { fileURLToPath } from "node:url";

export interface AppConfig {
  accessTokenAudience: string;
  accessTokenIssuer: string;
  accessTokenSecret: string;
  clientOrigins: string[];
  cookieName: string;
  cookieSecure: boolean;
  databaseUri: string;
  googleOAuthCallbackUrl: string;
  googleOAuthClientId: string;
  googleOAuthClientSecret: string;
  googleOAuthFrontendRedirectUrl: string;
  googleOAuthStateCookieName: string;
  loginAttemptCooldownMs: number;
  loginAttemptLimit: number;
  loginAttemptWindowMs: number;
  loginThrottleSecret: string;
  port: number;
  searchProvider: "atlas" | "native";
  trustProxy: boolean | number | string;
}

const requireEnv = (
  env: NodeJS.ProcessEnv,
  name:
    | "ACCESS_TOKEN_SECRET"
    | "CLIENT_ORIGINS"
    | "DATABASE"
    | "DB_PASSWORD"
    | "GOOGLE_OAUTH_CALLBACK_URL"
    | "GOOGLE_OAUTH_CLIENT_ID"
    | "GOOGLE_OAUTH_CLIENT_SECRET"
    | "GOOGLE_OAUTH_FRONTEND_REDIRECT_URL"
    | "LOGIN_THROTTLE_SECRET",
) => {
  const value = env[name];

  if (!value) {
    throw new Error(`${name} env var is required`);
  }

  return value;
};

const parseOrigins = (value: string) =>
  value.split(",").map((origin) => {
    const normalizedOrigin = origin.trim().replace(/\/$/, "");
    const url = new URL(normalizedOrigin);

    if (!normalizedOrigin || !["http:", "https:"].includes(url.protocol)) {
      throw new Error("CLIENT_ORIGINS must contain HTTP(S) origins");
    }

    return url.origin;
  });

const validateAccessTokenSecret = (secret: string) => {
  if (new TextEncoder().encode(secret).byteLength < 32) {
    throw new Error("ACCESS_TOKEN_SECRET must be at least 32 bytes");
  }

  return secret;
};

const validateSecret = (secret: string, name: string) => {
  if (new TextEncoder().encode(secret).byteLength < 32) {
    throw new Error(`${name} must be at least 32 bytes`);
  }

  return secret;
};

const parseBoundedInteger = (
  value: string | undefined,
  defaultValue: number,
  name: string,
  maximum: number,
) => {
  const parsed = value === undefined ? defaultValue : Number(value);

  if (!Number.isInteger(parsed) || parsed <= 0 || parsed > maximum) {
    throw new Error(
      `${name} must be a positive integer no greater than ${maximum}`,
    );
  }

  return parsed;
};

const parsePort = (value: string | undefined) => {
  if (!value) {
    return 3000;
  }

  const port = Number(value);

  if (!Number.isInteger(port) || port <= 0 || port > 65535) {
    throw new Error("PORT must be an integer between 1 and 65535");
  }

  return port;
};

const parseSearchProvider = (
  value: string | undefined,
  isProduction: boolean,
): "atlas" | "native" => {
  if (value === undefined) {
    if (isProduction) {
      throw new Error("SEARCH_PROVIDER env var is required in production");
    }
    return "native";
  }
  if (value !== "atlas" && value !== "native") {
    throw new Error("SEARCH_PROVIDER must be atlas or native");
  }
  return value;
};

const parseGoogleUrl = (
  value: string,
  name: "GOOGLE_OAUTH_CALLBACK_URL" | "GOOGLE_OAUTH_FRONTEND_REDIRECT_URL",
  clientOrigins: readonly string[],
  isProduction: boolean,
) => {
  const url = new URL(value);

  if (!["http:", "https:"].includes(url.protocol)) {
    throw new Error(`${name} must be an HTTP(S) URL`);
  }

  if (isProduction && url.protocol !== "https:") {
    throw new Error(`${name} must use HTTPS in production`);
  }

  if (!clientOrigins.includes(url.origin)) {
    throw new Error(`${name} origin must be included in CLIENT_ORIGINS`);
  }

  if (
    name === "GOOGLE_OAUTH_CALLBACK_URL" &&
    url.pathname !== "/api/v1/auth/oauth/google/callback"
  ) {
    throw new Error(
      "GOOGLE_OAUTH_CALLBACK_URL must target /api/v1/auth/oauth/google/callback",
    );
  }

  return url.toString();
};

export const getEnvFilePath = () =>
  fileURLToPath(new URL("../../config.env", import.meta.url));

export const loadEnvFile = () => {
  dotenv.config({ path: getEnvFilePath() });
};

export const loadConfig = (env: NodeJS.ProcessEnv = process.env): AppConfig => {
  const database = requireEnv(env, "DATABASE");
  const databasePassword = requireEnv(env, "DB_PASSWORD");
  const isProduction = env.NODE_ENV === "production";
  const clientOrigins = parseOrigins(requireEnv(env, "CLIENT_ORIGINS"));
  const googleOAuthCallbackUrl = parseGoogleUrl(
    requireEnv(env, "GOOGLE_OAUTH_CALLBACK_URL"),
    "GOOGLE_OAUTH_CALLBACK_URL",
    clientOrigins,
    isProduction,
  );
  const googleOAuthFrontendRedirectUrl = parseGoogleUrl(
    requireEnv(env, "GOOGLE_OAUTH_FRONTEND_REDIRECT_URL"),
    "GOOGLE_OAUTH_FRONTEND_REDIRECT_URL",
    clientOrigins,
    isProduction,
  );

  return {
    accessTokenAudience: env.ACCESS_TOKEN_AUDIENCE ?? "intouch-client",
    accessTokenIssuer: env.ACCESS_TOKEN_ISSUER ?? "intouch-api",
    accessTokenSecret: validateAccessTokenSecret(
      requireEnv(env, "ACCESS_TOKEN_SECRET"),
    ),
    clientOrigins,
    cookieName: isProduction ? "__Secure-intouch_refresh" : "intouch_refresh",
    cookieSecure: isProduction,
    databaseUri: database.replace("<db_password>", databasePassword),
    googleOAuthCallbackUrl,
    googleOAuthClientId: requireEnv(env, "GOOGLE_OAUTH_CLIENT_ID"),
    googleOAuthClientSecret: requireEnv(env, "GOOGLE_OAUTH_CLIENT_SECRET"),
    googleOAuthFrontendRedirectUrl,
    googleOAuthStateCookieName: isProduction
      ? "__Secure-intouch_google_oauth_state"
      : "intouch_google_oauth_state",
    loginAttemptCooldownMs: parseBoundedInteger(
      env.LOGIN_ATTEMPT_COOLDOWN_MS,
      15 * 60 * 1000,
      "LOGIN_ATTEMPT_COOLDOWN_MS",
      24 * 60 * 60 * 1000,
    ),
    loginAttemptLimit: parseBoundedInteger(
      env.LOGIN_ATTEMPT_LIMIT,
      10,
      "LOGIN_ATTEMPT_LIMIT",
      100,
    ),
    loginAttemptWindowMs: parseBoundedInteger(
      env.LOGIN_ATTEMPT_WINDOW_MS,
      15 * 60 * 1000,
      "LOGIN_ATTEMPT_WINDOW_MS",
      24 * 60 * 60 * 1000,
    ),
    loginThrottleSecret: validateSecret(
      requireEnv(env, "LOGIN_THROTTLE_SECRET"),
      "LOGIN_THROTTLE_SECRET",
    ),
    port: parsePort(env.PORT),
    searchProvider: parseSearchProvider(env.SEARCH_PROVIDER, isProduction),
    trustProxy: isProduction ? 1 : "loopback",
  };
};
