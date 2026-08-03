import type { ClientSession } from "mongoose";
import { Types } from "mongoose";

import ConversationParticipantModel from "./conversation-participant.model.js";
import type {
  ConversationParticipant,
  ConversationParticipantRecord,
} from "./conversation.types.js";

interface ParticipantDocument extends ConversationParticipant {
  _id: Types.ObjectId;
}

export class ParticipantPersistenceConflictError extends Error {
  constructor(options?: ErrorOptions) {
    super("Conversation participant already exists", options);
    this.name = "ParticipantPersistenceConflictError";
  }
}

export interface CreateParticipantInput {
  organizationId: string;
  conversationId: string;
  userId: string;
  addedByUserId: string;
}

export interface ConversationParticipantRepository {
  create(input: CreateParticipantInput): Promise<ConversationParticipantRecord>;
  find(
    conversationId: string,
    userId: string,
  ): Promise<ConversationParticipantRecord | null>;
  listByConversation(
    conversationId: string,
  ): Promise<ConversationParticipantRecord[]>;
  listConversationIdsForUser(
    userId: string,
    conversationIds: readonly string[],
  ): Promise<string[]>;
  delete(conversationId: string, userId: string): Promise<boolean>;
  deleteByConversationId(conversationId: string): Promise<number>;
  deleteByOrganizationId(organizationId: string): Promise<number>;
}

const isDuplicateKeyError = (error: unknown) =>
  typeof error === "object" &&
  error !== null &&
  "code" in error &&
  error.code === 11000;

const toParticipantRecord = (
  participant: ParticipantDocument,
): ConversationParticipantRecord => ({
  id: participant._id.toString(),
  organizationId: participant.organizationId.toString(),
  conversationId: participant.conversationId.toString(),
  userId: participant.userId.toString(),
  addedByUserId: participant.addedByUserId.toString(),
  joinedAt: participant.joinedAt,
});

const createMongooseConversationParticipantRepository = (
  session?: ClientSession,
): ConversationParticipantRepository => ({
  async create(input) {
    try {
      const participants = await ConversationParticipantModel.create(
        [input],
        session ? { session } : {},
      );
      const participant = participants[0];

      if (!participant) {
        throw new Error("Participant creation returned no document");
      }

      return toParticipantRecord(participant.toObject<ParticipantDocument>());
    } catch (error) {
      if (isDuplicateKeyError(error)) {
        throw new ParticipantPersistenceConflictError({ cause: error });
      }

      throw error;
    }
  },

  async find(conversationId, userId) {
    const query = ConversationParticipantModel.findOne({
      conversationId,
      userId,
    }).lean<ParticipantDocument>();
    if (session) query.session(session);
    const participant = await query.exec();
    return participant ? toParticipantRecord(participant) : null;
  },

  async listByConversation(conversationId) {
    const query = ConversationParticipantModel.find({ conversationId })
      .sort({ joinedAt: 1, _id: 1 })
      .lean<ParticipantDocument[]>();
    if (session) query.session(session);
    return (await query.exec()).map(toParticipantRecord);
  },

  async listConversationIdsForUser(userId, conversationIds) {
    if (conversationIds.length === 0) return [];
    const query = ConversationParticipantModel.find({
      userId,
      conversationId: { $in: conversationIds },
    })
      .select("conversationId")
      .lean<{ conversationId: Types.ObjectId }[]>();
    if (session) query.session(session);
    return (await query.exec()).map(({ conversationId }) =>
      conversationId.toString(),
    );
  },

  async delete(conversationId, userId) {
    const query = ConversationParticipantModel.deleteOne({
      conversationId,
      userId,
    });
    if (session) query.session(session);
    return (await query.exec()).deletedCount === 1;
  },

  async deleteByConversationId(conversationId) {
    const query = ConversationParticipantModel.deleteMany({ conversationId });
    if (session) query.session(session);
    return (await query.exec()).deletedCount;
  },

  async deleteByOrganizationId(organizationId) {
    const query = ConversationParticipantModel.deleteMany({ organizationId });
    if (session) query.session(session);
    return (await query.exec()).deletedCount;
  },
});

export default createMongooseConversationParticipantRepository;
