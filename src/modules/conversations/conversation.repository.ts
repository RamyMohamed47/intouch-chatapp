import type { ClientSession } from "mongoose";
import { Types } from "mongoose";

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
): ConversationRecord => ({
  id: conversation._id.toString(),
  organizationId: conversation.organizationId.toString(),
  categoryId: conversation.categoryId.toString(),
  name: conversation.name,
  type: conversation.type,
  visibility: conversation.visibility,
  position: conversation.position,
  createdAt: conversation.createdAt,
  updatedAt: conversation.updatedAt,
});

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

  async listByOrganization(organizationId, categoryId) {
    const query = ConversationModel.find({
      organizationId,
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
    const query = ConversationModel.countDocuments({ categoryId });
    if (session) query.session(session);
    return query.exec();
  },

  async updateById(conversationId, input) {
    try {
      const query = ConversationModel.findByIdAndUpdate(
        conversationId,
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
