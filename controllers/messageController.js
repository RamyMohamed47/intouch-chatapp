import {
  createMessage as createMessageService,
  getAllMessages as getAllMessagesService,
} from "../services/messageService.js";
import catchAsync from "../utils/catchAsync.js";

const getAllMessages = catchAsync(async (req, res) => {
  const messages = await getAllMessagesService();

  res.status(200).json(messages);
});

const createMessage = catchAsync(async (req, res) => {
  const message = await createMessageService(req.body);
  const messageResponse = message.toObject();
  const io = req.app.get("io");

  if (io) {
    io.emit("message", messageResponse);
  }

  res.status(201).json(messageResponse);
});

export { createMessage, getAllMessages };
