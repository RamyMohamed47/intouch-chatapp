import type {
  AddConversationParticipantInput,
  ListConversationsQuery,
} from "@intouch/shared/conversations";
import type { RequestHandler } from "express";

import UnauthorizedError from "../../errors/UnauthorizedError.js";
import catchAsync from "../../utils/catchAsync.js";
import type { AuthLocals } from "../auth/auth.types.js";
import type {
  ConversationParams,
  ConversationParticipantParams,
  OrganizationConversationsParams,
} from "./conversation.schemas.js";
import type { ConversationService } from "./conversation.service.js";
import type {
  CreateConversationInput,
  UpdateConversationInput,
} from "./conversation.types.js";

const getUserId = (locals: AuthLocals) => {
  if (!locals.userId) throw new UnauthorizedError();
  return locals.userId;
};

export interface ConversationController {
  create: RequestHandler;
  list: RequestHandler;
  getById: RequestHandler;
  update: RequestHandler;
  delete: RequestHandler;
  listOrganizationMembers: RequestHandler;
  listParticipants: RequestHandler;
  addParticipant: RequestHandler;
  removeParticipant: RequestHandler;
}

const createConversationController = (
  service: ConversationService,
): ConversationController => ({
  create: catchAsync(async (req, res) => {
    const { organizationId } =
      req.params as unknown as OrganizationConversationsParams;
    const conversation = await service.create(
      getUserId(res.locals as AuthLocals),
      organizationId,
      req.body as CreateConversationInput,
    );
    res.status(201).json({ conversation });
  }),

  list: catchAsync(async (req, res) => {
    const { organizationId } =
      req.params as unknown as OrganizationConversationsParams;
    const { categoryId } = (
      res.locals as { validatedQuery: ListConversationsQuery }
    ).validatedQuery;
    const conversations = await service.list(
      getUserId(res.locals as AuthLocals),
      organizationId,
      categoryId,
    );
    res.status(200).json({ conversations });
  }),

  getById: catchAsync(async (req, res) => {
    const { conversationId } = req.params as unknown as ConversationParams;
    const conversation = await service.getById(
      getUserId(res.locals as AuthLocals),
      conversationId,
    );
    res.status(200).json({ conversation });
  }),

  update: catchAsync(async (req, res) => {
    const { conversationId } = req.params as unknown as ConversationParams;
    const conversation = await service.update(
      getUserId(res.locals as AuthLocals),
      conversationId,
      req.body as UpdateConversationInput,
    );
    res.status(200).json({ conversation });
  }),

  delete: catchAsync(async (req, res) => {
    const { conversationId } = req.params as unknown as ConversationParams;
    await service.delete(getUserId(res.locals as AuthLocals), conversationId);
    res.status(204).send();
  }),

  listOrganizationMembers: catchAsync(async (req, res) => {
    const { organizationId } =
      req.params as unknown as OrganizationConversationsParams;
    const members = await service.listOrganizationMembers(
      getUserId(res.locals as AuthLocals),
      organizationId,
    );
    res.status(200).json({ members });
  }),

  listParticipants: catchAsync(async (req, res) => {
    const { conversationId } = req.params as unknown as ConversationParams;
    const participants = await service.listParticipants(
      getUserId(res.locals as AuthLocals),
      conversationId,
    );
    res.status(200).json({ participants });
  }),

  addParticipant: catchAsync(async (req, res) => {
    const { conversationId } = req.params as unknown as ConversationParams;
    const { userId } = req.body as AddConversationParticipantInput;
    const participant = await service.addParticipant(
      getUserId(res.locals as AuthLocals),
      conversationId,
      userId,
    );
    res.status(201).json({ participant });
  }),

  removeParticipant: catchAsync(async (req, res) => {
    const { conversationId, userId } =
      req.params as unknown as ConversationParticipantParams;
    await service.removeParticipant(
      getUserId(res.locals as AuthLocals),
      conversationId,
      userId,
    );
    res.status(204).send();
  }),
});

export default createConversationController;
