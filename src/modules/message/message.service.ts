import type { CreateMessageInput } from "../../contracts/message.js";
import type { MessageRepository } from "./message.repository.js";

const createMessageService = (messageRepository: MessageRepository) => ({
  getAllMessages() {
    return messageRepository.findAll();
  },

  createMessage(messageData: CreateMessageInput) {
    return messageRepository.create(messageData);
  },
});

export type MessageService = ReturnType<typeof createMessageService>;

export default createMessageService;
