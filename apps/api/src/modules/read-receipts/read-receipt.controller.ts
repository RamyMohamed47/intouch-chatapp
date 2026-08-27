import type { UpdateReadReceiptInput } from "@intouch/shared/messages";
import { readReceiptResponseSchema } from "@intouch/shared/messages";
import { messageReadReceiptSummaryResponseSchema } from "@intouch/shared/messages";
import type { RequestHandler } from "express";

import UnauthorizedError from "../../errors/UnauthorizedError.js";
import catchAsync from "../../utils/catchAsync.js";
import type { AuthLocals } from "../auth/auth.types.js";
import type {
  MessageReadersParams,
  ReadReceiptParams,
} from "./read-receipt.schemas.js";
import type { ReadReceiptService } from "./read-receipt.service.js";

const getUserId = (locals: AuthLocals) => {
  if (!locals.userId) throw new UnauthorizedError();
  return locals.userId;
};

export interface ReadReceiptController {
  advance: RequestHandler;
  summarizeMessageReaders: RequestHandler;
}

const createReadReceiptController = (
  service: ReadReceiptService,
): ReadReceiptController => ({
  advance: catchAsync(async (req, res) => {
    const { conversationId } = req.params as unknown as ReadReceiptParams;
    const readReceipt = await service.advance(
      getUserId(res.locals as AuthLocals),
      conversationId,
      req.body as UpdateReadReceiptInput,
    );
    res.status(200).json(readReceiptResponseSchema.parse({ readReceipt }));
  }),
  summarizeMessageReaders: catchAsync(async (req, res) => {
    const { conversationId, messageId } =
      req.params as unknown as MessageReadersParams;
    const readReceiptSummary = await service.summarizeMessageReaders(
      getUserId(res.locals as AuthLocals),
      conversationId,
      messageId,
    );
    res
      .status(200)
      .json(
        messageReadReceiptSummaryResponseSchema.parse({ readReceiptSummary }),
      );
  }),
});

export default createReadReceiptController;
