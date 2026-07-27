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
import configureSocket from "./sockets/socket.js";

loadEnvFile();

const config = loadConfig();
const logger = getLogger();
const messageBroadcaster = createSocketMessageBroadcaster();
const app = createApp({ messageBroadcaster });
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
