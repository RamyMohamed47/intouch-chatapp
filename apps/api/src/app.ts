import compression from "compression";
import cookieParser from "cookie-parser";
import cors from "cors";
import express from "express";
import type { Router } from "express";
import helmet from "helmet";
import { healthResponseSchema } from "@intouch/shared/common";

import NotFoundError from "./errors/NotFoundError.js";
import ForbiddenError from "./errors/ForbiddenError.js";
import handleError from "./middleware/errorHandler.js";
import createHttpLogger from "./middleware/httpLogger.js";

export interface AppDependencies {
  allowedOrigins?: readonly string[];
  authRouter?: Router;
  categoryRouter?: Router;
  conversationMessageRouter?: Router;
  conversationRouter?: Router;
  directMessageRouter?: Router;
  invitationRouter?: Router;
  messageRouter?: Router;
  organizationAccessRouter?: Router;
  organizationConversationRouter?: Router;
  organizationRouter?: Router;
  readReceiptRouter?: Router;
  trustProxy?: boolean | number;
}

const createApp = ({
  allowedOrigins = ["http://localhost:5173"],
  authRouter,
  categoryRouter,
  conversationMessageRouter,
  conversationRouter,
  directMessageRouter,
  invitationRouter,
  messageRouter,
  organizationAccessRouter,
  organizationConversationRouter,
  organizationRouter,
  readReceiptRouter,
  trustProxy = false,
}: AppDependencies = {}) => {
  const app = express();

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
    res.status(200).json(
      healthResponseSchema.parse({
        status: "ok",
        uptime: process.uptime(),
        timestamp: new Date(),
      }),
    );
  });

  if (authRouter) {
    app.use("/api/v1/auth", authRouter);
  }

  if (organizationRouter) {
    app.use("/api/v1/organizations", organizationRouter);
  }

  if (organizationAccessRouter) {
    app.use("/api/v1/organizations", organizationAccessRouter);
  }

  if (categoryRouter) {
    app.use("/api/v1/organizations", categoryRouter);
  }

  if (organizationConversationRouter) {
    app.use("/api/v1/organizations", organizationConversationRouter);
  }

  if (directMessageRouter) {
    app.use("/api/v1/organizations", directMessageRouter);
  }

  if (conversationRouter) {
    app.use("/api/v1/conversations", conversationRouter);
  }

  if (conversationMessageRouter) {
    app.use("/api/v1/conversations", conversationMessageRouter);
  }

  if (readReceiptRouter) {
    app.use("/api/v1/conversations", readReceiptRouter);
  }

  if (invitationRouter) {
    app.use("/api/v1/invitations", invitationRouter);
  }

  if (messageRouter) {
    app.use("/api/v1/messages", messageRouter);
  }

  app.use((req, _res, next) => {
    next(new NotFoundError(`Cannot find ${req.originalUrl} on this server`));
  });

  app.use(handleError);

  return app;
};

export default createApp;
