import type {
  CreateMessageInput,
  MessageRecord,
} from "../contracts/message.js";

export interface MessageRepository {
  findAll(): Promise<MessageRecord[]>;
  create(messageData: CreateMessageInput): Promise<MessageRecord>;
}
