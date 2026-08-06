import express, { type RequestHandler } from "express";

import {
  validateBody,
  validateParams,
} from "../../middleware/validateRequest.js";
import type { ReadReceiptController } from "./read-receipt.controller.js";
import {
  readReceiptParamsSchema,
  updateReadReceiptSchema,
} from "./read-receipt.schemas.js";

const createReadReceiptRouter = (
  controller: ReadReceiptController,
  requireAccessToken: RequestHandler,
  updateReadReceiptLimit: RequestHandler,
) => {
  const router = express.Router();
  router.use(requireAccessToken);
  router.put(
    "/:conversationId/read-receipt",
    updateReadReceiptLimit,
    validateParams(readReceiptParamsSchema),
    validateBody(updateReadReceiptSchema),
    controller.advance,
  );
  return router;
};

export default createReadReceiptRouter;
