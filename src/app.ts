import compression from "compression";
import cookieParser from "cookie-parser";
import cors from "cors";
import express from "express";
import type { Router } from "express";
import helmet from "helmet";

import {
  createNoopMessageBroadcaster,
  type MessageBroadcaster,
} from "./broadcasting/messageBroadcaster.js";
import NotFoundError from "./errors/NotFoundError.js";
import ForbiddenError from "./errors/ForbiddenError.js";
import handleError from "./middleware/errorHandler.js";
import createHttpLogger from "./middleware/httpLogger.js";
import {
  createMessageController,
  createMessageRouter,
  createMessageService,
  createMongooseMessageRepository,
} from "./modules/message/index.js";

export interface AppDependencies {
  allowedOrigins?: readonly string[];
  authRouter?: Router;
  messageBroadcaster?: MessageBroadcaster;
  trustProxy?: boolean | number;
}

const createApp = ({
  allowedOrigins = ["http://localhost:5173"],
  authRouter,
  messageBroadcaster = createNoopMessageBroadcaster(),
  trustProxy = false,
}: AppDependencies = {}) => {
  const app = express();
  const messageRepository = createMongooseMessageRepository();
  const messageService = createMessageService(messageRepository);
  const messageController = createMessageController(
    messageService,
    messageBroadcaster,
  );

  app.set("trust proxy", trustProxy);
  app.use(helmet());
  app.use(
    cors({
      credentials: true,
      origin(origin, callback) {
        if (!origin || allowedOrigins.includes(origin)) {
          callback(null, true);
          return;
        }

        callback(new ForbiddenError("Origin is not allowed"));
      },
      preflightContinue: true,
    }),
  );
  app.use(compression());
  app.use(express.json({ limit: "10kb" }));
  app.use(express.urlencoded({ extended: true, limit: "10kb" }));
  app.use(cookieParser());
  app.use(createHttpLogger());

  app.get("/health", (_req, res) => {
    res.status(200).json({
      status: "ok",
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
    });
  });

  if (authRouter) {
    app.use("/api/v1/auth", authRouter);
  }

  app.use("/api/v1/messages", createMessageRouter(messageController));

  app.use((req, _res, next) => {
    next(new NotFoundError(`Cannot find ${req.originalUrl} on this server`));
  });

  app.use(handleError);

  return app;
};

export default createApp;
