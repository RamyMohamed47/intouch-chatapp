import type { ClientSession, PipelineStage } from "mongoose";
import { Types } from "mongoose";

import ConversationReadStateModel from "../read-receipts/read-receipt.model.js";
import type {
  ConversationReadState,
  ConversationReadStateRecord,
} from "../read-receipts/read-receipt.types.js";
import MessageModel from "./message.model.js";
import type { Message, MessageRecord } from "./message.types.js";

interface MessageDocument extends Message {
  _id: Types.ObjectId;
}

interface ReadStateDocument extends ConversationReadState {
  _id: Types.ObjectId;
}

interface LatestMessageResult {
  _id: Types.ObjectId;
  message: MessageDocument;
}

interface UnreadCountResult {
  _id: Types.ObjectId;
  count: number;
}

export interface ConversationSummaryState {
  conversationId: string;
  lastMessage: MessageRecord | null;
  unreadCount: number;
  readReceipt: ConversationReadStateRecord | null;
  peerReadReceipt: ConversationReadStateRecord | null;
}

export interface PeerReadStateTarget {
  conversationId: string;
  userId: string;
}

export interface ConversationSummaryRepository {
  getStates(
    conversationIds: readonly string[],
    userId: string,
    peerReadStateTargets?: readonly PeerReadStateTarget[],
  ): Promise<ConversationSummaryState[]>;
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

const toReadStateRecord = (
  state: ReadStateDocument,
): ConversationReadStateRecord => ({
  id: state._id.toString(),
  organizationId: state.organizationId.toString(),
  conversationId: state.conversationId.toString(),
  userId: state.userId.toString(),
  lastReadMessageId: state.lastReadMessageId.toString(),
  lastReadAt: state.lastReadAt,
});

const createMongooseConversationSummaryRepository = (
  session?: ClientSession,
): ConversationSummaryRepository => ({
  async getStates(conversationIds, userId, peerReadStateTargets = []) {
    if (conversationIds.length === 0) return [];
    const objectIds = conversationIds.map((id) => new Types.ObjectId(id));
    const receiptQuery = ConversationReadStateModel.find({
      userId,
      conversationId: { $in: objectIds },
    }).lean<ReadStateDocument[]>();
    if (session) receiptQuery.session(session);
    const readStates = await receiptQuery.exec();
    const readStateByConversation = new Map(
      readStates.map((state) => [
        state.conversationId.toString(),
        toReadStateRecord(state),
      ]),
    );

    const peerReadStateByConversation = new Map<
      string,
      ConversationReadStateRecord
    >();
    if (peerReadStateTargets.length > 0) {
      const peerReceiptQuery = ConversationReadStateModel.find({
        $or: peerReadStateTargets.map((target) => ({
          conversationId: target.conversationId,
          userId: target.userId,
        })),
      }).lean<ReadStateDocument[]>();
      if (session) peerReceiptQuery.session(session);
      for (const state of await peerReceiptQuery.exec()) {
        peerReadStateByConversation.set(
          state.conversationId.toString(),
          toReadStateRecord(state),
        );
      }
    }

    const latestPipeline: PipelineStage[] = [
      { $match: { conversationId: { $in: objectIds } } },
      { $sort: { _id: -1 } },
      { $group: { _id: "$conversationId", message: { $first: "$$ROOT" } } },
    ];
    const latestAggregation =
      MessageModel.aggregate<LatestMessageResult>(latestPipeline);
    if (session) latestAggregation.session(session);
    const latestMessages = await latestAggregation.exec();
    const latestByConversation = new Map(
      latestMessages.map((result) => [
        result._id.toString(),
        toMessageRecord(result.message),
      ]),
    );

    const unreadBranches = conversationIds.map((conversationId) => {
      const readState = readStateByConversation.get(conversationId);
      return {
        conversationId: new Types.ObjectId(conversationId),
        ...(readState
          ? { _id: { $gt: new Types.ObjectId(readState.lastReadMessageId) } }
          : {}),
      };
    });
    const unreadPipeline: PipelineStage[] = [
      {
        $match: {
          senderId: { $ne: new Types.ObjectId(userId) },
          deletedAt: null,
          $or: unreadBranches,
        },
      },
      { $group: { _id: "$conversationId", count: { $sum: 1 } } },
    ];
    const unreadAggregation =
      MessageModel.aggregate<UnreadCountResult>(unreadPipeline);
    if (session) unreadAggregation.session(session);
    const unreadCounts = new Map(
      (await unreadAggregation.exec()).map((result) => [
        result._id.toString(),
        result.count,
      ]),
    );

    return conversationIds.map((conversationId) => ({
      conversationId,
      lastMessage: latestByConversation.get(conversationId) ?? null,
      unreadCount: unreadCounts.get(conversationId) ?? 0,
      readReceipt: readStateByConversation.get(conversationId) ?? null,
      peerReadReceipt: peerReadStateByConversation.get(conversationId) ?? null,
    }));
  },
});

export default createMongooseConversationSummaryRepository;
