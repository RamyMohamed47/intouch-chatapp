import type { RequestHandler } from "express";

import type { MessageBroadcaster } from "../broadcasting/messageBroadcaster.js";
import type { CreateMessageInput } from "../contracts/message.js";
import type { MessageService } from "../services/messageService.js";
import catchAsync from "../utils/catchAsync.js";

export interface MessageController {
  getAllMessages: RequestHandler;
  createMessage: RequestHandler;
}

const createMessageController = (
  messageService: MessageService,
  messageBroadcaster: MessageBroadcaster,
): MessageController => ({
  getAllMessages: catchAsync(async (_req, res) => {
    const messages = await messageService.getAllMessages();

    res.status(200).json(messages);
  }),

  createMessage: catchAsync(async (req, res) => {
    const message = await messageService.createMessage(
      req.body as CreateMessageInput,
    );

    messageBroadcaster.broadcastMessage(message);

    res.status(201).json(message);
  }),
});

export default createMessageController;
