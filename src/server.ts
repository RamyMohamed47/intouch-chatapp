import http from "node:http";
import { Server } from "socket.io";

import createApp from "./app.js";
import createSocketMessageBroadcaster from "./broadcasting/messageBroadcaster.js";
import { loadConfig, loadEnvFile } from "./config/env.js";
import connectDatabase, { disconnectDatabase } from "./config/database.js";
import { getLogger } from "./config/logger.js";
import type {
  ClientToServerEvents,
  InterServerEvents,
  ServerToClientEvents,
  SocketData,
} from "./contracts/socket.js";
import createAuthModule from "./modules/auth/index.js";
import configureSocket from "./sockets/socket.js";

loadEnvFile();

const logger = getLogger();
type InTouchServer = Server<
  ClientToServerEvents,
  ServerToClientEvents,
  InterServerEvents,
  SocketData
>;

const resources: {
  server?: http.Server;
  io?: InTouchServer;
} = {};
let shutdownPromise: Promise<void> | undefined;

const closeSocketServer = async () => {
  const socketServer = resources.io;

  if (!socketServer) {
    return;
  }

  await new Promise<void>((resolve, reject) => {
    void socketServer.close((error?: Error) => {
      if (error) {
        reject(error);
        return;
      }

      resolve();
    });
  });
};

const closeHttpServer = async () => {
  const httpServer = resources.server;

  if (!httpServer?.listening) {
    return;
  }

  await new Promise<void>((resolve, reject) => {
    httpServer.close((error) => {
      const isNotRunningError =
        error !== undefined &&
        "code" in error &&
        error.code === "ERR_SERVER_NOT_RUNNING";

      if (error && !isNotRunningError) {
        reject(error);
        return;
      }

      resolve();
    });
  });
};

const shutdown = (
  reason: string,
  exitCode: number,
  error?: unknown,
): Promise<void> => {
  if (shutdownPromise) {
    return shutdownPromise;
  }

  shutdownPromise = (async () => {
    if (error === undefined) {
      logger.info({ reason }, "Graceful shutdown started");
    } else {
      logger.fatal({ err: error, reason }, "Fatal process error");
    }

    const forceShutdownTimer = setTimeout(() => {
      logger.fatal({ reason }, "Graceful shutdown timed out");
      resources.server?.closeAllConnections();
      process.exit(1);
    }, 10_000);
    forceShutdownTimer.unref();

    try {
      await closeSocketServer();
      await closeHttpServer();
      await disconnectDatabase(logger);
      clearTimeout(forceShutdownTimer);
      logger.info({ reason }, "Graceful shutdown complete");
      process.exit(exitCode);
    } catch (shutdownError) {
      clearTimeout(forceShutdownTimer);
      logger.fatal({ err: shutdownError, reason }, "Graceful shutdown failed");
      resources.server?.closeAllConnections();
      process.exit(1);
    }
  })();

  return shutdownPromise;
};

process.once("uncaughtException", (error) => {
  void shutdown("uncaughtException", 1, error);
});

process.once("unhandledRejection", (reason) => {
  void shutdown("unhandledRejection", 1, reason);
});

process.once("SIGTERM", () => {
  void shutdown("SIGTERM", 0);
});

process.once("SIGINT", () => {
  void shutdown("SIGINT", 0);
});

const config = loadConfig();
const messageBroadcaster = createSocketMessageBroadcaster();
const auth = createAuthModule({
  accessTokenSecret: config.accessTokenSecret,
  accessTokenIssuer: config.accessTokenIssuer,
  accessTokenAudience: config.accessTokenAudience,
  allowedOrigins: config.clientOrigins,
  cookie: {
    name: config.cookieName,
    secure: config.cookieSecure,
    maxAgeMs: 30 * 24 * 60 * 60 * 1000,
  },
  googleOAuth: {
    callbackUrl: config.googleOAuthCallbackUrl,
    clientId: config.googleOAuthClientId,
    clientSecret: config.googleOAuthClientSecret,
    frontendRedirectUrl: config.googleOAuthFrontendRedirectUrl,
    stateCookie: {
      name: config.googleOAuthStateCookieName,
      secure: config.cookieSecure,
      maxAgeMs: 10 * 60 * 1000,
    },
  },
});
const app = createApp({
  allowedOrigins: config.clientOrigins,
  authRouter: auth.router,
  messageBroadcaster,
  trustProxy: config.trustProxy,
});
const server = http.createServer(app);
const io = new Server<
  ClientToServerEvents,
  ServerToClientEvents,
  InterServerEvents,
  SocketData
>(server);
resources.server = server;
resources.io = io;

messageBroadcaster.setSocketServer(io);
configureSocket(io, logger);

try {
  await connectDatabase(config.databaseUri, logger);

  server.listen(config.port, () => {
    logger.info({ port: config.port }, "Server running");
  });
} catch (err) {
  await shutdown("Database connection failed", 1, err);
}
