import type { ClientSession } from "mongoose";
import { Types } from "mongoose";

import MessageModel from "./message.model.js";
import type {
  CreateMessageRecordInput,
  Message,
  MessageRecord,
} from "./message.types.js";
import type { MessageMention } from "@intouch/shared/messages";

interface MessageDocument extends Message {
  _id: Types.ObjectId;
}

export interface MessageRepository {
  create(input: CreateMessageRecordInput): Promise<MessageRecord>;
  findById(messageId: string): Promise<MessageRecord | null>;
  findByIds?(messageIds: readonly string[]): Promise<MessageRecord[]>;
  listByConversation(
    conversationId: string,
    before: string | undefined,
    limit: number,
  ): Promise<MessageRecord[]>;
  listContext(
    conversationId: string,
    messageId: string,
    radius: number,
  ): Promise<{
    messages: MessageRecord[];
    hasEarlier: boolean;
    hasLater: boolean;
  }>;
  updateContent(
    messageId: string,
    content: string | null,
    mentions: readonly MessageMention[],
    notifiedMentionUserIds: readonly string[],
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
  ...(message.callId ? { callId: message.callId.toString() } : {}),
  ...(message.replyToMessageId
    ? { replyToMessageId: message.replyToMessageId.toString() }
    : {}),
  mentions: (message.mentions ?? []).map(({ userId, start, end }) => ({
    userId: userId.toString(),
    start,
    end,
  })),
  notifiedMentionUserIds: (message.notifiedMentionUserIds ?? []).map((id) =>
    id.toString(),
  ),
  editedAt: message.editedAt,
  deletedAt: message.deletedAt,
  createdAt: message.createdAt,
  updatedAt: message.updatedAt,
  attachments: [],
  call: null,
  replyTo: null,
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
    const query = MessageModel.findById(messageId)
      .select("+notifiedMentionUserIds")
      .lean<MessageDocument>();
    if (session) query.session(session);
    const message = await query.exec();
    return message ? toMessageRecord(message) : null;
  },

  async findByIds(messageIds) {
    if (messageIds.length === 0) return [];
    const query = MessageModel.find({ _id: { $in: messageIds } }).lean<
      MessageDocument[]
    >();
    if (session) query.session(session);
    return (await query.exec()).map(toMessageRecord);
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

  async listContext(conversationId, messageId, radius) {
    const [anchor, older, newer] = await Promise.all([
      MessageModel.findOne({ _id: messageId, conversationId })
        .lean<MessageDocument>()
        .session(session ?? null)
        .exec(),
      MessageModel.find({ conversationId, _id: { $lt: messageId } })
        .sort({ _id: -1 })
        .limit(radius + 1)
        .lean<MessageDocument[]>()
        .session(session ?? null)
        .exec(),
      MessageModel.find({ conversationId, _id: { $gt: messageId } })
        .sort({ _id: 1 })
        .limit(radius + 1)
        .lean<MessageDocument[]>()
        .session(session ?? null)
        .exec(),
    ]);
    if (!anchor) return { messages: [], hasEarlier: false, hasLater: false };
    const visibleOlder = older.slice(0, radius);
    const visibleNewer = newer.slice(0, radius).reverse();
    return {
      messages: [
        ...visibleNewer.map(toMessageRecord),
        toMessageRecord(anchor),
        ...visibleOlder.map(toMessageRecord),
      ],
      hasEarlier: older.length > radius,
      hasLater: newer.length > radius,
    };
  },

  async updateContent(
    messageId,
    content,
    mentions,
    notifiedMentionUserIds,
    editedAt,
  ) {
    const query = MessageModel.findOneAndUpdate(
      { _id: messageId, deletedAt: null },
      { $set: { content, mentions, notifiedMentionUserIds, editedAt } },
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
