import type { ClientSession, PipelineStage } from "mongoose";
import { Types } from "mongoose";

import MessageReactionModel from "./message-reaction.model.js";
import type {
  MessageReaction,
  MessageReactionRecord,
  MessageReactionStateRecord,
  MessageReactionUserPage,
} from "./message-reaction.types.js";

interface MessageReactionDocument extends MessageReaction {
  _id: Types.ObjectId;
}

interface ReactionSummaryResult {
  _id: { messageId: Types.ObjectId; emoji: string };
  count: number;
  currentUserReacted: boolean;
}

export interface UpsertMessageReactionInput {
  conversationId: string;
  messageId: string;
  userId: string;
  emoji: string;
}

export interface MessageReactionRepository {
  findForUser(
    messageId: string,
    userId: string,
  ): Promise<MessageReactionRecord | null>;
  upsert(input: UpsertMessageReactionInput): Promise<MessageReactionRecord>;
  deleteForUser(messageId: string, userId: string): Promise<boolean>;
  summarize(
    messageIds: readonly string[],
    currentUserId: string,
    eligibleUserIds: readonly string[],
  ): Promise<MessageReactionStateRecord[]>;
  listUsers(
    messageId: string,
    emoji: string,
    eligibleUserIds: readonly string[],
    before: string | undefined,
    limit: number,
  ): Promise<MessageReactionUserPage>;
  deleteByMessageId(messageId: string): Promise<number>;
  deleteByConversationId(conversationId: string): Promise<number>;
  deleteByConversationIds(conversationIds: readonly string[]): Promise<number>;
  deleteByConversationAndUser(
    conversationId: string,
    userId: string,
  ): Promise<number>;
  deleteByConversationExceptUsers(
    conversationId: string,
    retainedUserIds: readonly string[],
  ): Promise<number>;
}

const toRecord = (
  reaction: MessageReactionDocument,
): MessageReactionRecord => ({
  id: reaction._id.toString(),
  conversationId: reaction.conversationId.toString(),
  messageId: reaction.messageId.toString(),
  userId: reaction.userId.toString(),
  emoji: reaction.emoji,
  createdAt: reaction.createdAt,
  updatedAt: reaction.updatedAt,
});

const createMongooseMessageReactionRepository = (
  session?: ClientSession,
): MessageReactionRepository => ({
  async findForUser(messageId, userId) {
    const query = MessageReactionModel.findOne({
      messageId,
      userId,
    }).lean<MessageReactionDocument>();
    if (session) query.session(session);
    const reaction = await query.exec();
    return reaction ? toRecord(reaction) : null;
  },

  async upsert(input) {
    const query = MessageReactionModel.findOneAndUpdate(
      { messageId: input.messageId, userId: input.userId },
      {
        $set: {
          conversationId: input.conversationId,
          emoji: input.emoji,
        },
      },
      {
        new: true,
        runValidators: true,
        setDefaultsOnInsert: true,
        upsert: true,
      },
    ).lean<MessageReactionDocument>();
    if (session) query.session(session);
    const reaction = await query.exec();
    if (!reaction)
      throw new Error("Message reaction upsert returned no document");
    return toRecord(reaction);
  },

  async deleteForUser(messageId, userId) {
    const query = MessageReactionModel.deleteOne({ messageId, userId });
    if (session) query.session(session);
    return (await query.exec()).deletedCount > 0;
  },

  async summarize(messageIds, currentUserId, eligibleUserIds) {
    if (messageIds.length === 0 || eligibleUserIds.length === 0) return [];
    const pipeline: PipelineStage[] = [
      {
        $match: {
          messageId: {
            $in: messageIds.map((id) => new Types.ObjectId(id)),
          },
          userId: {
            $in: eligibleUserIds.map((id) => new Types.ObjectId(id)),
          },
        },
      },
      {
        $group: {
          _id: { messageId: "$messageId", emoji: "$emoji" },
          count: { $sum: 1 },
          currentUserReacted: {
            $max: {
              $eq: ["$userId", new Types.ObjectId(currentUserId)],
            },
          },
        },
      },
      { $sort: { count: -1, "_id.emoji": 1 } },
    ];
    const aggregation =
      MessageReactionModel.aggregate<ReactionSummaryResult>(pipeline);
    if (session) aggregation.session(session);
    const grouped = new Map<string, MessageReactionStateRecord>();
    for (const result of await aggregation.exec()) {
      const messageId = result._id.messageId.toString();
      const state = grouped.get(messageId) ?? {
        messageId,
        reactions: [],
        currentUserReaction: null,
      };
      state.reactions.push({ emoji: result._id.emoji, count: result.count });
      if (result.currentUserReacted) {
        state.currentUserReaction = result._id.emoji;
      }
      grouped.set(messageId, state);
    }
    return [...grouped.values()];
  },

  async listUsers(messageId, emoji, eligibleUserIds, before, limit) {
    if (eligibleUserIds.length === 0) return { records: [], total: 0 };
    const filter = {
      messageId,
      emoji,
      userId: { $in: eligibleUserIds },
      ...(before ? { _id: { $lt: before } } : {}),
    };
    const pageQuery = MessageReactionModel.find(filter)
      .sort({ _id: -1 })
      .limit(limit)
      .lean<MessageReactionDocument[]>();
    const totalQuery = MessageReactionModel.countDocuments({
      messageId,
      emoji,
      userId: { $in: eligibleUserIds },
    });
    if (session) {
      pageQuery.session(session);
      totalQuery.session(session);
    }
    const [records, total] = await Promise.all([
      pageQuery.exec(),
      totalQuery.exec(),
    ]);
    return { records: records.map(toRecord), total };
  },

  async deleteByMessageId(messageId) {
    const query = MessageReactionModel.deleteMany({ messageId });
    if (session) query.session(session);
    return (await query.exec()).deletedCount;
  },

  async deleteByConversationId(conversationId) {
    const query = MessageReactionModel.deleteMany({ conversationId });
    if (session) query.session(session);
    return (await query.exec()).deletedCount;
  },

  async deleteByConversationIds(conversationIds) {
    if (conversationIds.length === 0) return 0;
    const query = MessageReactionModel.deleteMany({
      conversationId: { $in: conversationIds },
    });
    if (session) query.session(session);
    return (await query.exec()).deletedCount;
  },

  async deleteByConversationAndUser(conversationId, userId) {
    const query = MessageReactionModel.deleteMany({ conversationId, userId });
    if (session) query.session(session);
    return (await query.exec()).deletedCount;
  },

  async deleteByConversationExceptUsers(conversationId, retainedUserIds) {
    const query = MessageReactionModel.deleteMany({
      conversationId,
      userId: { $nin: retainedUserIds },
    });
    if (session) query.session(session);
    return (await query.exec()).deletedCount;
  },
});

export default createMongooseMessageReactionRepository;
