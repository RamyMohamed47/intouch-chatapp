import type { ClientSession } from "mongoose";
import { Types } from "mongoose";

import ConversationReadStateModel from "./read-receipt.model.js";
import type {
  AdvanceConversationReadStateInput,
  ConversationReadState,
  ConversationReadStateRecord,
} from "./read-receipt.types.js";

interface ConversationReadStateDocument extends ConversationReadState {
  _id: Types.ObjectId;
}

export interface ConversationReadStateRepository {
  advance(
    input: AdvanceConversationReadStateInput,
  ): Promise<ConversationReadStateRecord>;
  find(
    conversationId: string,
    userId: string,
  ): Promise<ConversationReadStateRecord | null>;
  findForUserByConversations(
    userId: string,
    conversationIds: readonly string[],
  ): Promise<ConversationReadStateRecord[]>;
  deleteByConversationId(conversationId: string): Promise<number>;
  deleteByOrganizationId(organizationId: string): Promise<number>;
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
  ): Promise<ConversationReadStateRecord> => {
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
    if (updated) return toConversationReadStateRecord(updated);

    const current = await find(input.conversationId, input.userId);
    if (current) return current;

    try {
      const receipts = await ConversationReadStateModel.create(
        [input],
        session ? { session } : {},
      );
      const receipt = receipts[0];
      if (!receipt)
        throw new Error("Read receipt creation returned no document");
      return toConversationReadStateRecord(
        receipt.toObject<ConversationReadStateDocument>(),
      );
    } catch (error) {
      if (!isDuplicateKeyError(error)) throw error;
      const raced = await find(input.conversationId, input.userId);
      if (!raced) throw error;
      if (raced.lastReadMessageId < input.lastReadMessageId) {
        return advance(input);
      }
      return raced;
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
