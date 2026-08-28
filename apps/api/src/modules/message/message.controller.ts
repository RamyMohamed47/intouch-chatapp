import type {
  CreateMessageInput,
  MessageHistoryQuery,
  UpdateMessageInput,
} from "@intouch/shared/messages";
import {
  messageContextResponseSchema,
  messageListResponseSchema,
  messageResponseSchema,
} from "@intouch/shared/messages";
import type { RequestHandler } from "express";

import UnauthorizedError from "../../errors/UnauthorizedError.js";
import catchAsync from "../../utils/catchAsync.js";
import type { AuthLocals } from "../auth/auth.types.js";
import type {
  ConversationMessagesParams,
  MessageContextParams,
  MessageParams,
} from "./message.schemas.js";
import type { MessageService } from "./message.service.js";

const getUserId = (locals: AuthLocals) => {
  if (!locals.userId) throw new UnauthorizedError();
  return locals.userId;
};

export interface MessageController {
  list: RequestHandler;
  context: RequestHandler;
  create: RequestHandler;
  update: RequestHandler;
  delete: RequestHandler;
}

const createMessageController = (
  service: MessageService,
): MessageController => ({
  context: catchAsync(async (req, res) => {
    const { conversationId, messageId } =
      req.params as unknown as MessageContextParams;
    const context = await service.context(
      getUserId(res.locals as AuthLocals),
      conversationId,
      messageId,
    );
    res.status(200).json(messageContextResponseSchema.parse(context));
  }),

  list: catchAsync(async (req, res) => {
    const { conversationId } =
      req.params as unknown as ConversationMessagesParams;
    const page = await service.list(
      getUserId(res.locals as AuthLocals),
      conversationId,
      (res.locals as { validatedQuery: MessageHistoryQuery }).validatedQuery,
    );
    res.status(200).json(messageListResponseSchema.parse(page));
  }),

  create: catchAsync(async (req, res) => {
    const { conversationId } =
      req.params as unknown as ConversationMessagesParams;
    const message = await service.create(
      getUserId(res.locals as AuthLocals),
      conversationId,
      req.body as CreateMessageInput,
    );
    res.status(201).json(messageResponseSchema.parse({ message }));
  }),

  update: catchAsync(async (req, res) => {
    const { messageId } = req.params as unknown as MessageParams;
    const message = await service.update(
      getUserId(res.locals as AuthLocals),
      messageId,
      req.body as UpdateMessageInput,
    );
    res.status(200).json(messageResponseSchema.parse({ message }));
  }),

  delete: catchAsync(async (req, res) => {
    const { messageId } = req.params as unknown as MessageParams;
    await service.delete(getUserId(res.locals as AuthLocals), messageId);
    res.status(204).send();
  }),
});

export default createMessageController;
