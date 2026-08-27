import type { ClientSession } from "mongoose";
import { Types } from "mongoose";

import ConversationParticipantModel from "../conversations/conversation-participant.model.js";
import MembershipModel from "../memberships/membership.model.js";
import { UserModel } from "../user/user.model.js";
import ConversationReadStateModel from "./read-receipt.model.js";
import type {
  AdvanceConversationReadStateInput,
  AdvanceConversationReadStateResult,
  ConversationReadState,
  ConversationReadStateRecord,
  MessageReadReceiptSummaryRecord,
  SummarizeMessageReadersInput,
} from "./read-receipt.types.js";

interface ConversationReadStateDocument extends ConversationReadState {
  _id: Types.ObjectId;
}

export interface ConversationReadStateRepository {
  advance(
    input: AdvanceConversationReadStateInput,
  ): Promise<AdvanceConversationReadStateResult>;
  find(
    conversationId: string,
    userId: string,
  ): Promise<ConversationReadStateRecord | null>;
  findForUserByConversations(
    userId: string,
    conversationIds: readonly string[],
  ): Promise<ConversationReadStateRecord[]>;
  summarizeMessageReaders(
    input: SummarizeMessageReadersInput,
  ): Promise<MessageReadReceiptSummaryRecord>;
  deleteByConversationId(conversationId: string): Promise<number>;
  deleteByOrganizationId(organizationId: string): Promise<number>;
}

interface MessageReaderAggregationResult {
  metadata: Array<{ readByCount: number }>;
  readers: Array<{
    id: Types.ObjectId;
    username: string;
    displayName: string;
    avatarUrl?: string;
  }>;
}

const toConversationReadStateRecord = (
  receipt: ConversationReadStateDocument,
): ConversationReadStateRecord => ({
  id: receipt._id.toString(),
  organizationId: receipt.organizationId.toString(),
  conversationId: receipt.conversationId.toString(),
  userId: receipt.userId.toString(),
  lastReadMessageId: receipt.lastReadMessageId.toString(),
  lastReadAt: receipt.lastReadAt,
});

const isDuplicateKeyError = (error: unknown) =>
  typeof error === "object" &&
  error !== null &&
  "code" in error &&
  error.code === 11000;

const createMongooseConversationReadStateRepository = (
  session?: ClientSession,
): ConversationReadStateRepository => {
  const find = async (conversationId: string, userId: string) => {
    const query = ConversationReadStateModel.findOne({
      conversationId,
      userId,
    }).lean<ConversationReadStateDocument>();
    if (session) query.session(session);
    const receipt = await query.exec();
    return receipt ? toConversationReadStateRecord(receipt) : null;
  };

  const advance = async (
    input: AdvanceConversationReadStateInput,
  ): Promise<AdvanceConversationReadStateResult> => {
    const updateQuery = ConversationReadStateModel.findOneAndUpdate(
      {
        conversationId: input.conversationId,
        userId: input.userId,
        lastReadMessageId: { $lt: input.lastReadMessageId },
      },
      {
        $set: {
          lastReadMessageId: input.lastReadMessageId,
          lastReadAt: input.lastReadAt,
        },
      },
      { new: true },
    ).lean<ConversationReadStateDocument>();
    if (session) updateQuery.session(session);
    const updated = await updateQuery.exec();
    if (updated) {
      return {
        readState: toConversationReadStateRecord(updated),
        advanced: true,
      };
    }

    const current = await find(input.conversationId, input.userId);
    if (current) return { readState: current, advanced: false };

    try {
      const receipts = await ConversationReadStateModel.create(
        [input],
        session ? { session } : {},
      );
      const receipt = receipts[0];
      if (!receipt)
        throw new Error("Read receipt creation returned no document");
      return {
        readState: toConversationReadStateRecord(
          receipt.toObject<ConversationReadStateDocument>(),
        ),
        advanced: true,
      };
    } catch (error) {
      if (!isDuplicateKeyError(error)) throw error;
      const raced = await find(input.conversationId, input.userId);
      if (!raced) throw error;
      if (raced.lastReadMessageId < input.lastReadMessageId) {
        return advance(input);
      }
      return { readState: raced, advanced: false };
    }
  };

  return {
    advance,
    find,

    async findForUserByConversations(userId, conversationIds) {
      if (conversationIds.length === 0) return [];
      const query = ConversationReadStateModel.find({
        userId,
        conversationId: { $in: conversationIds },
      }).lean<ConversationReadStateDocument[]>();
      if (session) query.session(session);
      return (await query.exec()).map(toConversationReadStateRecord);
    },

    async summarizeMessageReaders(input) {
      const participantStages = input.requireParticipant
        ? [
            {
              $lookup: {
                from: ConversationParticipantModel.collection.name,
                let: { readerUserId: "$userId" },
                pipeline: [
                  {
                    $match: {
                      $expr: {
                        $and: [
                          {
                            $eq: [
                              "$conversationId",
                              new Types.ObjectId(input.conversationId),
                            ],
                          },
                          { $eq: ["$userId", "$$readerUserId"] },
                        ],
                      },
                    },
                  },
                  { $limit: 1 },
                ],
                as: "participant",
              },
            },
            { $match: { "participant.0": { $exists: true } } },
          ]
        : [];
      const query =
        ConversationReadStateModel.aggregate<MessageReaderAggregationResult>([
          {
            $match: {
              conversationId: new Types.ObjectId(input.conversationId),
              lastReadMessageId: { $gte: new Types.ObjectId(input.messageId) },
              userId: { $ne: new Types.ObjectId(input.senderId) },
            },
          },
          {
            $lookup: {
              from: MembershipModel.collection.name,
              let: { readerUserId: "$userId" },
              pipeline: [
                {
                  $match: {
                    $expr: {
                      $and: [
                        {
                          $eq: [
                            "$organizationId",
                            new Types.ObjectId(input.organizationId),
                          ],
                        },
                        { $eq: ["$userId", "$$readerUserId"] },
                      ],
                    },
                  },
                },
                { $limit: 1 },
              ],
              as: "membership",
            },
          },
          { $match: { "membership.0": { $exists: true } } },
          ...participantStages,
          { $sort: { lastReadAt: -1, userId: 1 } },
          {
            $facet: {
              metadata: [{ $count: "readByCount" }],
              readers: [
                { $limit: 3 },
                {
                  $lookup: {
                    from: UserModel.collection.name,
                    localField: "userId",
                    foreignField: "_id",
                    as: "user",
                  },
                },
                { $unwind: "$user" },
                {
                  $project: {
                    _id: 0,
                    id: "$user._id",
                    username: "$user.username",
                    displayName: "$user.displayName",
                    avatarUrl: "$user.avatarUrl",
                  },
                },
              ],
            },
          },
        ]);
      if (session) query.session(session);
      const [summary] = await query.exec();
      return {
        messageId: input.messageId,
        readByCount: summary?.metadata[0]?.readByCount ?? 0,
        readers:
          summary?.readers.map((reader) => ({
            id: reader.id.toString(),
            username: reader.username,
            displayName: reader.displayName,
            ...(reader.avatarUrl ? { avatarUrl: reader.avatarUrl } : {}),
          })) ?? [],
      };
    },

    async deleteByConversationId(conversationId) {
      const query = ConversationReadStateModel.deleteMany({ conversationId });
      if (session) query.session(session);
      return (await query.exec()).deletedCount;
    },

    async deleteByOrganizationId(organizationId) {
      const query = ConversationReadStateModel.deleteMany({ organizationId });
      if (session) query.session(session);
      return (await query.exec()).deletedCount;
    },
  };
};

export default createMongooseConversationReadStateRepository;
