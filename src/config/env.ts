import dotenv from "dotenv";

export interface AppConfig {
  databaseUri: string;
  port: number;
}

const requireEnv = (
  env: NodeJS.ProcessEnv,
  name: "DATABASE" | "DB_PASSWORD",
) => {
  const value = env[name];

  if (!value) {
    throw new Error(`${name} env var is required`);
  }

  return value;
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

  return {
    databaseUri: database.replace("<db_password>", databasePassword),
    port: parsePort(env.PORT),
  };
};
