import type { ClientSession } from "mongoose";
import { Types } from "mongoose";
import {
  ConversationType,
  type ConversationTypeValue,
} from "@intouch/shared/conversations";

import ConversationModel from "./conversation.model.js";
import type {
  Conversation,
  ConversationRecord,
  CreateConversationRecordInput,
  UpdateConversationRecordInput,
} from "./conversation.types.js";

interface ConversationDocument extends Conversation {
  _id: Types.ObjectId;
}

export class ConversationPersistenceConflictError extends Error {
  constructor(options?: ErrorOptions) {
    super("Conversation name already exists", options);
    this.name = "ConversationPersistenceConflictError";
  }
}

export interface ConversationRepository {
  create(input: CreateConversationRecordInput): Promise<ConversationRecord>;
  findById(conversationId: string): Promise<ConversationRecord | null>;
  findByIds(
    conversationIds: readonly string[],
    type?: ConversationTypeValue,
  ): Promise<ConversationRecord[]>;
  findDirectByParticipantKey(
    organizationId: string,
    directParticipantKey: string,
  ): Promise<ConversationRecord | null>;
  listDirectForParticipant(
    organizationId: string,
    userId: string,
    before: { activityAt: Date; conversationId: string } | undefined,
    limit: number,
  ): Promise<ConversationRecord[]>;
  listByOrganization(
    organizationId: string,
    categoryId?: string,
  ): Promise<ConversationRecord[]>;
  listIdsByOrganization(organizationId: string): Promise<string[]>;
  countByCategory(categoryId: string): Promise<number>;
  updateById(
    conversationId: string,
    input: UpdateConversationRecordInput,
  ): Promise<ConversationRecord | null>;
  touchActivity(conversationId: string, activityAt: Date): Promise<boolean>;
  shiftPositions(
    categoryId: string,
    minimum: number,
    maximum: number,
    amount: number,
  ): Promise<void>;
  deleteById(conversationId: string): Promise<boolean>;
  deleteByOrganizationId(organizationId: string): Promise<number>;
}

const isDuplicateKeyError = (error: unknown) =>
  typeof error === "object" &&
  error !== null &&
  "code" in error &&
  error.code === 11000;

const toConversationRecord = (
  conversation: ConversationDocument,
): ConversationRecord => {
  const record: ConversationRecord = {
    id: conversation._id.toString(),
    organizationId: conversation.organizationId.toString(),
    type: conversation.type,
    createdAt: conversation.createdAt,
    updatedAt: conversation.updatedAt,
  };
  if (conversation.activityAt !== undefined) {
    record.activityAt = conversation.activityAt;
  }
  if (conversation.categoryId)
    record.categoryId = conversation.categoryId.toString();
  if (conversation.name !== undefined) record.name = conversation.name;
  if (conversation.visibility !== undefined)
    record.visibility = conversation.visibility;
  if (conversation.position !== undefined)
    record.position = conversation.position;
  if (conversation.directParticipantKey !== undefined) {
    record.directParticipantKey = conversation.directParticipantKey;
  }
  return record;
};

const createMongooseConversationRepository = (
  session?: ClientSession,
): ConversationRepository => ({
  async create(input) {
    try {
      const conversations = await ConversationModel.create(
        [input],
        session ? { session } : {},
      );
      const conversation = conversations[0];

      if (!conversation) {
        throw new Error("Conversation creation returned no document");
      }

      return toConversationRecord(
        conversation.toObject<ConversationDocument>(),
      );
    } catch (error) {
      if (isDuplicateKeyError(error)) {
        throw new ConversationPersistenceConflictError({ cause: error });
      }

      throw error;
    }
  },

  async findById(conversationId) {
    const query =
      ConversationModel.findById(conversationId).lean<ConversationDocument>();
    if (session) query.session(session);
    const conversation = await query.exec();
    return conversation ? toConversationRecord(conversation) : null;
  },

  async findByIds(conversationIds, type) {
    if (conversationIds.length === 0) return [];
    const query = ConversationModel.find({
      _id: { $in: conversationIds },
      ...(type ? { type } : {}),
    }).lean<ConversationDocument[]>();
    if (session) query.session(session);
    return (await query.exec()).map(toConversationRecord);
  },

  async findDirectByParticipantKey(organizationId, directParticipantKey) {
    const query = ConversationModel.findOne({
      organizationId,
      type: ConversationType.DIRECT,
      directParticipantKey,
    }).lean<ConversationDocument>();
    if (session) query.session(session);
    const conversation = await query.exec();
    return conversation ? toConversationRecord(conversation) : null;
  },

  async listDirectForParticipant(organizationId, userId, before, limit) {
    const activityCursor = before
      ? {
          $or: [
            { activityAt: { $lt: before.activityAt } },
            {
              activityAt: before.activityAt,
              _id: { $lt: before.conversationId },
            },
          ],
        }
      : {};
    const query = ConversationModel.find({
      organizationId,
      type: ConversationType.DIRECT,
      $and: [
        {
          $or: [
            { directParticipantAId: userId },
            { directParticipantBId: userId },
          ],
        },
        activityCursor,
      ],
    })
      .select("+activityAt")
      .sort({ activityAt: -1, _id: -1 })
      .limit(limit)
      .lean<ConversationDocument[]>();
    if (session) query.session(session);
    return (await query.exec()).map(toConversationRecord);
  },

  async listByOrganization(organizationId, categoryId) {
    const query = ConversationModel.find({
      organizationId,
      type: ConversationType.CHANNEL,
      ...(categoryId ? { categoryId } : {}),
    })
      .sort({ categoryId: 1, position: 1, _id: 1 })
      .lean<ConversationDocument[]>();
    if (session) query.session(session);
    return (await query.exec()).map(toConversationRecord);
  },

  async listIdsByOrganization(organizationId) {
    const query = ConversationModel.find({ organizationId })
      .select("_id")
      .lean<{ _id: Types.ObjectId }[]>();
    if (session) query.session(session);
    return (await query.exec()).map(({ _id }) => _id.toString());
  },

  async countByCategory(categoryId) {
    const query = ConversationModel.countDocuments({
      categoryId,
      type: ConversationType.CHANNEL,
    });
    if (session) query.session(session);
    return query.exec();
  },

  async updateById(conversationId, input) {
    try {
      const query = ConversationModel.findOneAndUpdate(
        { _id: conversationId, type: ConversationType.CHANNEL },
        { $set: input },
        { new: true, runValidators: true },
      ).lean<ConversationDocument>();
      if (session) query.session(session);
      const conversation = await query.exec();
      return conversation ? toConversationRecord(conversation) : null;
    } catch (error) {
      if (isDuplicateKeyError(error)) {
        throw new ConversationPersistenceConflictError({ cause: error });
      }

      throw error;
    }
  },

  async touchActivity(conversationId, activityAt) {
    const query = ConversationModel.updateOne(
      { _id: conversationId },
      { $max: { activityAt } },
      { timestamps: false },
    );
    if (session) query.session(session);
    return (await query.exec()).matchedCount === 1;
  },

  async shiftPositions(categoryId, minimum, maximum, amount) {
    if (minimum > maximum || amount === 0) return;
    const query = ConversationModel.updateMany(
      { categoryId, position: { $gte: minimum, $lte: maximum } },
      { $inc: { position: amount } },
    );
    if (session) query.session(session);
    await query.exec();
  },

  async deleteById(conversationId) {
    const query = ConversationModel.deleteOne({ _id: conversationId });
    if (session) query.session(session);
    return (await query.exec()).deletedCount === 1;
  },

  async deleteByOrganizationId(organizationId) {
    const query = ConversationModel.deleteMany({ organizationId });
    if (session) query.session(session);
    return (await query.exec()).deletedCount;
  },
});

export default createMongooseConversationRepository;
