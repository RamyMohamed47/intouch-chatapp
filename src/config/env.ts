import dotenv from "dotenv";

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
  port: number;
  trustProxy: boolean | number;
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
    | "GOOGLE_OAUTH_FRONTEND_REDIRECT_URL",
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

export const loadEnvFile = () => {
  dotenv.config({ path: "./config.env" });
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
    port: parsePort(env.PORT),
    trustProxy: isProduction ? 1 : false,
  };
};
