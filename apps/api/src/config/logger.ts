import pino from "pino";
import { trace } from "@opentelemetry/api";

import type { Logger, LoggerOptions } from "pino";

const logLevels = [
  "fatal",
  "error",
  "warn",
  "info",
  "debug",
  "trace",
  "silent",
] as const;

export type LogLevel = (typeof logLevels)[number];

const isLogLevel = (value: string): value is LogLevel =>
  logLevels.includes(value as LogLevel);

export const resolveLogLevel = (
  env: NodeJS.ProcessEnv = process.env,
): LogLevel => {
  const logLevel = env.LOG_LEVEL;

  if (logLevel) {
    if (!isLogLevel(logLevel)) {
      throw new Error(`LOG_LEVEL must be one of: ${logLevels.join(", ")}`);
    }

    return logLevel;
  }

  return env.NODE_ENV === "test" ? "silent" : "info";
};

export const createLoggerOptions = (
  env: NodeJS.ProcessEnv = process.env,
): LoggerOptions => {
  const options: LoggerOptions = {
    name: "intouch",
    level: resolveLogLevel(env),
    base: {
      deploymentId: env.RAILWAY_DEPLOYMENT_ID,
      environment: env.RAILWAY_ENVIRONMENT_NAME ?? env.NODE_ENV,
      pid: process.pid,
      replicaId: env.RAILWAY_REPLICA_ID,
      service: env.RAILWAY_SERVICE_NAME ?? "intouch-api",
    },
    mixin() {
      const context = trace.getActiveSpan()?.spanContext();
      return context
        ? { spanId: context.spanId, traceId: context.traceId }
        : {};
    },
    serializers: {
      err: pino.stdSerializers.err,
    },
  };

  if (env.NODE_ENV === "development") {
    return {
      ...options,
      transport: {
        target: "pino-pretty",
        options: {
          colorize: true,
          ignore: "pid,hostname",
          translateTime: "SYS:standard",
        },
      },
    };
  }

  return options;
};

export const createLogger = (env: NodeJS.ProcessEnv = process.env): Logger =>
  pino(createLoggerOptions(env));

let logger: Logger | undefined;

export const getLogger = (): Logger => {
  logger ??= createLogger();

  return logger;
};
