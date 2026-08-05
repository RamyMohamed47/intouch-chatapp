import type {
  CreateDirectMessageInput,
  ListDirectMessagesQuery,
} from "@intouch/shared/conversations";
import {
  directMessageListResponseSchema,
  directMessageResponseSchema,
} from "@intouch/shared/conversations";
import type { RequestHandler } from "express";

import UnauthorizedError from "../../errors/UnauthorizedError.js";
import catchAsync from "../../utils/catchAsync.js";
import type { AuthLocals } from "../auth/auth.types.js";
import type { DirectMessageOrganizationParams } from "./direct-message.schemas.js";
import type { DirectMessageService } from "./direct-message.service.js";

const getUserId = (locals: AuthLocals) => {
  if (!locals.userId) throw new UnauthorizedError();
  return locals.userId;
};

export interface DirectMessageController {
  create: RequestHandler;
  list: RequestHandler;
}

const createDirectMessageController = (
  service: DirectMessageService,
): DirectMessageController => ({
  create: catchAsync(async (req, res) => {
    const { organizationId } =
      req.params as unknown as DirectMessageOrganizationParams;
    const result = await service.create(
      getUserId(res.locals as AuthLocals),
      organizationId,
      req.body as CreateDirectMessageInput,
    );
    res.status(result.created ? 201 : 200).json(
      directMessageResponseSchema.parse({
        directMessage: result.directMessage,
      }),
    );
  }),

  list: catchAsync(async (req, res) => {
    const { organizationId } =
      req.params as unknown as DirectMessageOrganizationParams;
    const page = await service.list(
      getUserId(res.locals as AuthLocals),
      organizationId,
      (res.locals as { validatedQuery: ListDirectMessagesQuery })
        .validatedQuery,
    );
    res.status(200).json(directMessageListResponseSchema.parse(page));
  }),
});

export default createDirectMessageController;
