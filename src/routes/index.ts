import express from "express";

import type { MessageController } from "../controllers/messageController.js";
import createMessageRouter from "./messageRoutes.js";

export interface ApiRouterDependencies {
  messageController: MessageController;
}

const createApiRouter = ({ messageController }: ApiRouterDependencies) => {
  const apiRouter = express.Router();

  apiRouter.use("/messages", createMessageRouter(messageController));

  return apiRouter;
};

export default createApiRouter;
