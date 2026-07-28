import http from "node:http";
import { Server } from "socket.io";

import createApp from "./app.js";
import createSocketMessageBroadcaster from "./broadcasting/messageBroadcaster.js";
import { loadConfig, loadEnvFile } from "./config/env.js";
import connectDatabase from "./config/database.js";
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

const config = loadConfig();
const logger = getLogger();
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

messageBroadcaster.setSocketServer(io);
configureSocket(io, logger);

try {
  await connectDatabase(config.databaseUri, logger);

  server.listen(config.port, () => {
    logger.info({ port: config.port }, "Server running");
  });
} catch (err) {
  logger.fatal({ err }, "DB connection failed");
  process.exit(1);
}
