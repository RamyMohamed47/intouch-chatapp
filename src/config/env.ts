import dotenv from "dotenv";

export interface AppConfig {
  accessTokenAudience: string;
  accessTokenIssuer: string;
  accessTokenSecret: string;
  clientOrigins: string[];
  cookieName: string;
  cookieSecure: boolean;
  databaseUri: string;
  port: number;
  trustProxy: boolean | number;
}

const requireEnv = (
  env: NodeJS.ProcessEnv,
  name: "ACCESS_TOKEN_SECRET" | "CLIENT_ORIGINS" | "DATABASE" | "DB_PASSWORD",
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

export const loadEnvFile = () => {
  dotenv.config({ path: "./config.env" });
};

export const loadConfig = (env: NodeJS.ProcessEnv = process.env): AppConfig => {
  const database = requireEnv(env, "DATABASE");
  const databasePassword = requireEnv(env, "DB_PASSWORD");
  const isProduction = env.NODE_ENV === "production";

  return {
    accessTokenAudience: env.ACCESS_TOKEN_AUDIENCE ?? "intouch-client",
    accessTokenIssuer: env.ACCESS_TOKEN_ISSUER ?? "intouch-api",
    accessTokenSecret: validateAccessTokenSecret(
      requireEnv(env, "ACCESS_TOKEN_SECRET"),
    ),
    clientOrigins: parseOrigins(requireEnv(env, "CLIENT_ORIGINS")),
    cookieName: isProduction ? "__Secure-intouch_refresh" : "intouch_refresh",
    cookieSecure: isProduction,
    databaseUri: database.replace("<db_password>", databasePassword),
    port: parsePort(env.PORT),
    trustProxy: isProduction ? 1 : false,
  };
};
