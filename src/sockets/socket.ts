import type { InTouchSocketServer } from "../contracts/socket.js";
import { getLogger } from "../config/logger.js";

import type { Logger } from "pino";

const configureSocket = (
  io: InTouchSocketServer,
  logger: Logger = getLogger(),
) => {
  io.on("connection", (socket) => {
    logger.debug({ socketId: socket.id }, "Socket connected");

    socket.on("disconnect", () => {
      logger.debug({ socketId: socket.id }, "Socket disconnected");
    });
  });
};

export default configureSocket;
