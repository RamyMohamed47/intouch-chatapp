import compression from "compression";
import cors from "cors";
import express from "express";
import helmet from "helmet";

import {
  createNoopMessageBroadcaster,
  type MessageBroadcaster,
} from "./broadcasting/messageBroadcaster.js";
import createMessageController from "./controllers/messageController.js";
import handleError from "./controllers/errorController.js";
import createHttpLogger from "./middleware/httpLogger.js";
import createMongooseMessageRepository from "./repositories/mongooseMessageRepository.js";
import createApiRouter from "./routes/index.js";
import createMessageService from "./services/messageService.js";
import NotFoundError from "./errors/NotFoundError.js";

export interface AppDependencies {
  messageBroadcaster?: MessageBroadcaster;
}

const createApp = ({
  messageBroadcaster = createNoopMessageBroadcaster(),
}: AppDependencies = {}) => {
  const app = express();
  const messageRepository = createMongooseMessageRepository();
  const messageService = createMessageService(messageRepository);
  const messageController = createMessageController(
    messageService,
    messageBroadcaster,
  );

  app.use(helmet());
  app.use(cors({ preflightContinue: true }));
  app.use(compression());
  app.use(express.json({ limit: "10kb" }));
  app.use(express.urlencoded({ extended: true, limit: "10kb" }));
  app.use(createHttpLogger());

  app.get("/health", (_req, res) => {
    res.status(200).json({
      status: "ok",
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
    });
  });

  app.use("/api/v1", createApiRouter({ messageController }));

  app.use((req, _res, next) => {
    next(new NotFoundError(`Cannot find ${req.originalUrl} on this server`));
  });

  app.use(handleError);

  return app;
};

export default createApp;
