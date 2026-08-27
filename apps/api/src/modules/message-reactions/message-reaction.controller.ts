import type {
  MessageReactionUsersQuery,
  SetMessageReactionInput,
} from "@intouch/shared/messages";
import {
  messageReactionStateResponseSchema,
  messageReactionUsersResponseSchema,
} from "@intouch/shared/messages";
import type { RequestHandler } from "express";

import UnauthorizedError from "../../errors/UnauthorizedError.js";
import catchAsync from "../../utils/catchAsync.js";
import type { AuthLocals } from "../auth/auth.types.js";
import type { MessageReactionService } from "./message-reaction.service.js";
import type { MessageReactionParams } from "./message-reaction.schemas.js";

const getUserId = (locals: AuthLocals) => {
  if (!locals.userId) throw new UnauthorizedError();
  return locals.userId;
};

export interface MessageReactionController {
  getState: RequestHandler;
  listUsers: RequestHandler;
  remove: RequestHandler;
  set: RequestHandler;
}

const createMessageReactionController = (
  service: MessageReactionService,
): MessageReactionController => ({
  getState: catchAsync(async (req, res) => {
    const { messageId } = req.params as unknown as MessageReactionParams;
    const reactionState = await service.getState(
      getUserId(res.locals as AuthLocals),
      messageId,
    );
    res
      .status(200)
      .json(messageReactionStateResponseSchema.parse({ reactionState }));
  }),

  listUsers: catchAsync(async (req, res) => {
    const { messageId } = req.params as unknown as MessageReactionParams;
    const reactionUsers = await service.listUsers(
      getUserId(res.locals as AuthLocals),
      messageId,
      (res.locals as { validatedQuery: MessageReactionUsersQuery })
        .validatedQuery,
    );
    res
      .status(200)
      .json(messageReactionUsersResponseSchema.parse(reactionUsers));
  }),

  set: catchAsync(async (req, res) => {
    const { messageId } = req.params as unknown as MessageReactionParams;
    const reactionState = await service.set(
      getUserId(res.locals as AuthLocals),
      messageId,
      req.body as SetMessageReactionInput,
    );
    res
      .status(200)
      .json(messageReactionStateResponseSchema.parse({ reactionState }));
  }),

  remove: catchAsync(async (req, res) => {
    const { messageId } = req.params as unknown as MessageReactionParams;
    const reactionState = await service.remove(
      getUserId(res.locals as AuthLocals),
      messageId,
    );
    res
      .status(200)
      .json(messageReactionStateResponseSchema.parse({ reactionState }));
  }),
});

export default createMessageReactionController;
