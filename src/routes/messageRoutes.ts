import express from "express";

import type { MessageController } from "../controllers/messageController.js";

const createMessageRouter = (messageController: MessageController) => {
  const router = express.Router();

  router
    .route("/")
    .get(messageController.getAllMessages)
    .post(messageController.createMessage);

  return router;
};

export default createMessageRouter;
