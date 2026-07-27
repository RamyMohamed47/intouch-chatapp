import Message from "../models/messageModel.js";

import type { MessageRecord } from "../contracts/message.js";
import type { MessageRepository } from "./messageRepository.js";

const createMongooseMessageRepository = (): MessageRepository => ({
  async findAll() {
    return Message.find({}).lean<MessageRecord[]>();
  },

  async create(messageData) {
    const message = await Message.create(messageData);

    return message.toObject();
  },
});

export default createMongooseMessageRepository;
