import type { ClientSession } from "mongoose";
import { Types } from "mongoose";

import MessageModel from "./message.model.js";
import type {
  CreateMessageRecordInput,
  Message,
  MessageRecord,
} from "./message.types.js";

interface MessageDocument extends Message {
  _id: Types.ObjectId;
}

export interface MessageRepository {
  create(input: CreateMessageRecordInput): Promise<MessageRecord>;
  findById(messageId: string): Promise<MessageRecord | null>;
  listByConversation(
    conversationId: string,
    before: string | undefined,
    limit: number,
  ): Promise<MessageRecord[]>;
  updateContent(
    messageId: string,
    content: string,
    editedAt: Date,
  ): Promise<MessageRecord | null>;
  redact(messageId: string, deletedAt: Date): Promise<MessageRecord | null>;
  deleteByConversationId(conversationId: string): Promise<number>;
  deleteByConversationIds(conversationIds: readonly string[]): Promise<number>;
}

const toMessageRecord = (message: MessageDocument): MessageRecord => ({
  id: message._id.toString(),
  conversationId: message.conversationId.toString(),
  senderId: message.senderId.toString(),
  content: message.content,
  messageType: message.messageType,
  editedAt: message.editedAt,
  deletedAt: message.deletedAt,
  createdAt: message.createdAt,
  updatedAt: message.updatedAt,
});

const createMongooseMessageRepository = (
  session?: ClientSession,
): MessageRepository => ({
  async create(input) {
    const messages = await MessageModel.create(
      [input],
      session ? { session } : {},
    );
    const message = messages[0];
    if (!message) throw new Error("Message creation returned no document");
    return toMessageRecord(message.toObject<MessageDocument>());
  },

  async findById(messageId) {
    const query = MessageModel.findById(messageId).lean<MessageDocument>();
    if (session) query.session(session);
    const message = await query.exec();
    return message ? toMessageRecord(message) : null;
  },

  async listByConversation(conversationId, before, limit) {
    const query = MessageModel.find({
      conversationId,
      ...(before ? { _id: { $lt: before } } : {}),
    })
      .sort({ _id: -1 })
      .limit(limit)
      .lean<MessageDocument[]>();
    if (session) query.session(session);
    return (await query.exec()).map(toMessageRecord);
  },

  async updateContent(messageId, content, editedAt) {
    const query = MessageModel.findOneAndUpdate(
      { _id: messageId, deletedAt: null },
      { $set: { content, editedAt } },
      { new: true, runValidators: true },
    ).lean<MessageDocument>();
    if (session) query.session(session);
    const message = await query.exec();
    return message ? toMessageRecord(message) : null;
  },

  async redact(messageId, deletedAt) {
    const query = MessageModel.findByIdAndUpdate(
      messageId,
      { $set: { content: null, deletedAt } },
      { new: true },
    ).lean<MessageDocument>();
    if (session) query.session(session);
    const message = await query.exec();
    return message ? toMessageRecord(message) : null;
  },

  async deleteByConversationId(conversationId) {
    const query = MessageModel.deleteMany({ conversationId });
    if (session) query.session(session);
    return (await query.exec()).deletedCount;
  },

  async deleteByConversationIds(conversationIds) {
    if (conversationIds.length === 0) return 0;
    const query = MessageModel.deleteMany({
      conversationId: { $in: conversationIds },
    });
    if (session) query.session(session);
    return (await query.exec()).deletedCount;
  },
});

export default createMongooseMessageRepository;
