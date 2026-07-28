import type {
  CreateMessageInput,
  MessageRecord,
} from "../../contracts/message.js";
import MessageModel from "./message.model.js";

export interface MessageRepository {
  findAll(): Promise<MessageRecord[]>;
  create(messageData: CreateMessageInput): Promise<MessageRecord>;
}

const createMongooseMessageRepository = (): MessageRepository => ({
  async findAll() {
    return MessageModel.find({}).lean<MessageRecord[]>();
  },

  async create(messageData) {
    const message = await MessageModel.create(messageData);

    return message.toObject();
  },
});

export default createMongooseMessageRepository;
