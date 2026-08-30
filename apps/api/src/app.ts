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
  apiDocsRouter?: Router;
  assetRouter?: Router;
  authRouter?: Router;
  categoryRouter?: Router;
  conversationMessageRouter?: Router;
  conversationChatWallpaperRouter?: Router;
  conversationRouter?: Router;
  directMessageRouter?: Router;
  invitationRouter?: Router;
  messageRouter?: Router;
  messageReactionRouter?: Router;
  notificationRouter?: Router;
  organizationAccessRouter?: Router;
  organizationConversationRouter?: Router;
  organizationRouter?: Router;
  readReceiptRouter?: Router;
  searchRouter?: Router;
  userChatWallpaperRouter?: Router;
  uploadRouter?: Router;
  userAvatarRouter?: Router;
  trustProxy?: boolean | number | string;
}

const createApp = ({
  allowedOrigins = ["http://localhost:5173"],
  apiDocsRouter,
  assetRouter,
  authRouter,
  categoryRouter,
  conversationMessageRouter,
  conversationChatWallpaperRouter,
  conversationRouter,
  directMessageRouter,
  invitationRouter,
  messageRouter,
  messageReactionRouter,
  notificationRouter,
  organizationAccessRouter,
  organizationConversationRouter,
  organizationRouter,
  readReceiptRouter,
  searchRouter,
  userChatWallpaperRouter,
  uploadRouter,
  userAvatarRouter,
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

  if (apiDocsRouter) {
    app.use("/api", apiDocsRouter);
  }

  if (authRouter) {
    app.use("/api/v1/auth", authRouter);
  }

  if (uploadRouter) {
    app.use("/api/v1/uploads", uploadRouter);
  }

  if (assetRouter) {
    app.use("/api/v1/assets", assetRouter);
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

  if (conversationChatWallpaperRouter) {
    app.use("/api/v1/conversations", conversationChatWallpaperRouter);
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

  if (messageReactionRouter) {
    app.use("/api/v1/messages", messageReactionRouter);
  }

  if (notificationRouter) {
    app.use("/api/v1/notifications", notificationRouter);
  }

  if (searchRouter) {
    app.use("/api/v1/organizations", searchRouter);
  }

  if (userChatWallpaperRouter) {
    app.use("/api/v1/users", userChatWallpaperRouter);
  }

  if (userAvatarRouter) {
    app.use("/api/v1/users", userAvatarRouter);
  }

  app.use((req, _res, next) => {
    next(new NotFoundError(`Cannot find ${req.originalUrl} on this server`));
  });

  app.use(handleError);

  return app;
};

export default createApp;
