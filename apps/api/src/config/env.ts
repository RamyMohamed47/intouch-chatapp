import dotenv from "dotenv";
import { fileURLToPath } from "node:url";

export type MailTransportConfig =
  | {
      provider: "brevo";
      apiKey: string;
    }
  | {
      provider: "smtp";
      host: string;
      password: string;
      port: number;
      requireTls: boolean;
      secure: boolean;
      user: string;
    };

export type StorageConfig =
  | { provider: "disabled" }
  | {
      provider: "r2";
      accountId: string;
      accessKeyId: string;
      secretAccessKey: string;
      bucketName: string;
    };

export type RuntimeStateConfig =
  | { provider: "memory"; keyPrefix: string }
  | { provider: "redis"; keyPrefix: string; url: string };

export type ObservabilityConfig =
  | {
      provider: "disabled";
      sentryDsn?: string;
    }
  | {
      provider: "otlp";
      endpoint: string;
      headers?: string;
      sampleRatio: number;
      sentryDsn?: string;
      serviceName: string;
    };

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
  authActionTokenSecret: string;
  backgroundJobsProvider: "bullmq" | "polling";
  mailOutboxEncryptionSecret: string;
  mailFromAddress: string;
  mailFromName: string;
  mailTransport: MailTransportConfig;
  webAppUrl: string;
  port: number;
  searchProvider: "atlas" | "native";
  trustProxy: boolean | number | string;
  storage: StorageConfig;
  uploadDailyUserBytes: number;
  organizationStorageBytes: number;
  observability: ObservabilityConfig;
  runtimeState: RuntimeStateConfig;
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
    | "LOGIN_THROTTLE_SECRET"
    | "AUTH_ACTION_TOKEN_SECRET"
    | "BREVO_API_KEY"
    | "MAIL_OUTBOX_ENCRYPTION_SECRET"
    | "MAIL_FROM_ADDRESS"
    | "MAIL_FROM_NAME"
    | "SMTP_HOST"
    | "SMTP_PASSWORD"
    | "SMTP_USER"
    | "WEB_APP_URL"
    | "R2_ACCOUNT_ID"
    | "R2_ACCESS_KEY_ID"
    | "R2_SECRET_ACCESS_KEY"
    | "R2_BUCKET_NAME"
    | "REDIS_URL",
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

const parseBoolean = (value: string | undefined, name: string) => {
  if (value === "true") return true;
  if (value === "false") return false;
  throw new Error(`${name} must be true or false`);
};

const parseEmailAddress = (value: string) => {
  const normalized = value.trim().toLowerCase();

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)) {
    throw new Error("MAIL_FROM_ADDRESS must be a valid email address");
  }

  return normalized;
};

const parseWebAppUrl = (
  value: string,
  clientOrigins: readonly string[],
  isProduction: boolean,
) => {
  const url = new URL(value);
  if (!["http:", "https:"].includes(url.protocol)) {
    throw new Error("WEB_APP_URL must be an HTTP(S) URL");
  }
  if (isProduction && url.protocol !== "https:") {
    throw new Error("WEB_APP_URL must use HTTPS in production");
  }
  if (!clientOrigins.includes(url.origin)) {
    throw new Error("WEB_APP_URL origin must be included in CLIENT_ORIGINS");
  }
  return url.origin;
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

const parseStorage = (
  env: NodeJS.ProcessEnv,
  isProduction: boolean,
): StorageConfig => {
  const provider =
    env.STORAGE_PROVIDER ?? (isProduction ? undefined : "disabled");
  if (provider === undefined) {
    throw new Error("STORAGE_PROVIDER env var is required in production");
  }
  if (provider === "disabled") {
    if (isProduction) {
      throw new Error("STORAGE_PROVIDER must be r2 in production");
    }
    return { provider };
  }
  if (provider !== "r2") {
    throw new Error("STORAGE_PROVIDER must be r2 or disabled");
  }
  return {
    provider,
    accountId: requireEnv(env, "R2_ACCOUNT_ID"),
    accessKeyId: requireEnv(env, "R2_ACCESS_KEY_ID"),
    secretAccessKey: requireEnv(env, "R2_SECRET_ACCESS_KEY"),
    bucketName: requireEnv(env, "R2_BUCKET_NAME"),
  };
};

const parseRuntimeState = (
  env: NodeJS.ProcessEnv,
  isProduction: boolean,
): RuntimeStateConfig => {
  const provider =
    env.RUNTIME_STATE_PROVIDER ?? (isProduction ? undefined : "memory");
  const environment = env.NODE_ENV ?? "development";
  const keyPrefix = env.REDIS_KEY_PREFIX ?? `intouch:${environment}:v2`;

  if (!/^[a-zA-Z0-9:_-]{1,80}$/.test(keyPrefix)) {
    throw new Error(
      "REDIS_KEY_PREFIX must use only letters, numbers, colons, underscores, or hyphens",
    );
  }
  if (provider === undefined) {
    throw new Error("RUNTIME_STATE_PROVIDER env var is required in production");
  }
  if (provider === "memory") {
    if (isProduction) {
      throw new Error("RUNTIME_STATE_PROVIDER must be redis in production");
    }
    return { provider, keyPrefix };
  }
  if (provider !== "redis") {
    throw new Error("RUNTIME_STATE_PROVIDER must be memory or redis");
  }

  const url = new URL(requireEnv(env, "REDIS_URL"));
  if (!["redis:", "rediss:"].includes(url.protocol)) {
    throw new Error("REDIS_URL must use redis:// or rediss://");
  }
  return { provider, keyPrefix, url: url.toString() };
};

const parseBackgroundJobsProvider = (
  value: string | undefined,
  runtimeState: RuntimeStateConfig,
): "bullmq" | "polling" => {
  const provider =
    value ?? (runtimeState.provider === "redis" ? "bullmq" : "polling");

  if (provider !== "bullmq" && provider !== "polling") {
    throw new Error("BACKGROUND_JOBS_PROVIDER must be bullmq or polling");
  }
  if (provider === "bullmq" && runtimeState.provider !== "redis") {
    throw new Error(
      "BACKGROUND_JOBS_PROVIDER=bullmq requires RUNTIME_STATE_PROVIDER=redis",
    );
  }
  return provider;
};

const parseOptionalHttpsUrl = (
  value: string | undefined,
  name: string,
  isProduction: boolean,
) => {
  if (!value) return undefined;

  const url = new URL(value);
  if (!["http:", "https:"].includes(url.protocol)) {
    throw new Error(`${name} must be an HTTP(S) URL`);
  }
  if (isProduction && url.protocol !== "https:") {
    throw new Error(`${name} must use HTTPS in production`);
  }
  return url.toString().replace(/\/$/, "");
};

const parseSampleRatio = (value: string | undefined) => {
  const ratio = value === undefined ? 0.1 : Number(value);
  if (!Number.isFinite(ratio) || ratio < 0 || ratio > 1) {
    throw new Error("OTEL_TRACES_SAMPLER_ARG must be between 0 and 1");
  }
  return ratio;
};

export const parseObservabilityConfig = (
  env: NodeJS.ProcessEnv,
): ObservabilityConfig => {
  const isProduction = env.NODE_ENV === "production";
  const provider = env.OBSERVABILITY_PROVIDER ?? "disabled";
  const sentryDsn = parseOptionalHttpsUrl(
    env.SENTRY_DSN,
    "SENTRY_DSN",
    isProduction,
  );

  if (provider === "disabled") {
    if (env.OTEL_EXPORTER_OTLP_ENDPOINT || env.OTEL_EXPORTER_OTLP_HEADERS) {
      throw new Error("OTLP settings require OBSERVABILITY_PROVIDER=otlp");
    }
    return sentryDsn ? { provider, sentryDsn } : { provider };
  }
  if (provider !== "otlp") {
    throw new Error("OBSERVABILITY_PROVIDER must be disabled or otlp");
  }

  const endpoint = parseOptionalHttpsUrl(
    env.OTEL_EXPORTER_OTLP_ENDPOINT,
    "OTEL_EXPORTER_OTLP_ENDPOINT",
    isProduction,
  );
  if (!endpoint) {
    throw new Error(
      "OTEL_EXPORTER_OTLP_ENDPOINT is required when observability uses OTLP",
    );
  }
  if (isProduction && !env.OTEL_EXPORTER_OTLP_HEADERS) {
    throw new Error(
      "OTEL_EXPORTER_OTLP_HEADERS is required for production OTLP export",
    );
  }

  return {
    provider,
    endpoint,
    ...(env.OTEL_EXPORTER_OTLP_HEADERS
      ? { headers: env.OTEL_EXPORTER_OTLP_HEADERS }
      : {}),
    sampleRatio: parseSampleRatio(env.OTEL_TRACES_SAMPLER_ARG),
    ...(sentryDsn ? { sentryDsn } : {}),
    serviceName: env.OTEL_SERVICE_NAME?.trim() || "intouch-api",
  };
};

const parseMailTransport = (
  env: NodeJS.ProcessEnv,
  isProduction: boolean,
): MailTransportConfig => {
  const provider = env.MAIL_PROVIDER ?? (isProduction ? undefined : "smtp");

  if (provider === undefined) {
    throw new Error("MAIL_PROVIDER env var is required in production");
  }
  if (provider === "brevo") {
    return {
      provider,
      apiKey: requireEnv(env, "BREVO_API_KEY"),
    };
  }
  if (provider !== "smtp") {
    throw new Error("MAIL_PROVIDER must be brevo or smtp");
  }

  const requireTls = parseBoolean(
    env.SMTP_REQUIRE_TLS ?? "true",
    "SMTP_REQUIRE_TLS",
  );
  const secure = parseBoolean(env.SMTP_SECURE ?? "false", "SMTP_SECURE");

  if (isProduction && !requireTls && !secure) {
    throw new Error("SMTP transport must require TLS in production");
  }

  return {
    provider,
    host: requireEnv(env, "SMTP_HOST"),
    password: requireEnv(env, "SMTP_PASSWORD"),
    port: parseBoundedInteger(env.SMTP_PORT, 587, "SMTP_PORT", 65_535),
    requireTls,
    secure,
    user: requireEnv(env, "SMTP_USER"),
  };
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
  const mailTransport = parseMailTransport(env, isProduction);
  const runtimeState = parseRuntimeState(env, isProduction);

  return {
    authActionTokenSecret: validateSecret(
      requireEnv(env, "AUTH_ACTION_TOKEN_SECRET"),
      "AUTH_ACTION_TOKEN_SECRET",
    ),
    backgroundJobsProvider: parseBackgroundJobsProvider(
      env.BACKGROUND_JOBS_PROVIDER,
      runtimeState,
    ),
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
    mailOutboxEncryptionSecret: validateSecret(
      requireEnv(env, "MAIL_OUTBOX_ENCRYPTION_SECRET"),
      "MAIL_OUTBOX_ENCRYPTION_SECRET",
    ),
    mailFromAddress: parseEmailAddress(requireEnv(env, "MAIL_FROM_ADDRESS")),
    mailFromName: requireEnv(env, "MAIL_FROM_NAME"),
    mailTransport,
    port: parsePort(env.PORT),
    searchProvider: parseSearchProvider(env.SEARCH_PROVIDER, isProduction),
    storage: parseStorage(env, isProduction),
    uploadDailyUserBytes: parseBoundedInteger(
      env.UPLOAD_DAILY_USER_BYTES,
      524_288_000,
      "UPLOAD_DAILY_USER_BYTES",
      10_995_116_277_760,
    ),
    organizationStorageBytes: parseBoundedInteger(
      env.ORGANIZATION_STORAGE_BYTES,
      5_368_709_120,
      "ORGANIZATION_STORAGE_BYTES",
      10_995_116_277_760,
    ),
    observability: parseObservabilityConfig(env),
    runtimeState,
    trustProxy: isProduction ? 1 : "loopback",
    webAppUrl: parseWebAppUrl(
      requireEnv(env, "WEB_APP_URL"),
      clientOrigins,
      isProduction,
    ),
  };
};
