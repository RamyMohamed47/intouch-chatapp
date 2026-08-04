import type { ClientSession } from "mongoose";
import { Types } from "mongoose";

import InvitationModel from "./invitation.model.js";
import type {
  CreateInvitationRecordInput,
  Invitation,
  InvitationRecord,
} from "./invitation.types.js";

interface InvitationDocument extends Invitation {
  _id: Types.ObjectId;
}

export class InvitationPersistenceConflictError extends Error {
  constructor(options?: ErrorOptions) {
    super("Pending invitation already exists", options);
    this.name = "InvitationPersistenceConflictError";
  }
}

export interface InvitationRepository {
  create(input: CreateInvitationRecordInput): Promise<InvitationRecord>;
  findById(invitationId: string): Promise<InvitationRecord | null>;
  findByOrganizationAndUser(
    organizationId: string,
    userId: string,
  ): Promise<InvitationRecord | null>;
  findPendingByUser(userId: string, now: Date): Promise<InvitationRecord[]>;
  deleteById(invitationId: string): Promise<boolean>;
  deleteByOrganizationAndUser(
    organizationId: string,
    userId: string,
  ): Promise<number>;
  deleteExpiredByOrganizationAndUser(
    organizationId: string,
    userId: string,
    now: Date,
  ): Promise<number>;
  deleteByOrganizationId(organizationId: string): Promise<number>;
}

const isDuplicateKeyError = (error: unknown) =>
  typeof error === "object" &&
  error !== null &&
  "code" in error &&
  error.code === 11000;

const toInvitationRecord = (
  invitation: InvitationDocument,
): InvitationRecord => ({
  id: invitation._id.toString(),
  organizationId: invitation.organizationId.toString(),
  invitedUserId: invitation.invitedUserId.toString(),
  invitedByUserId: invitation.invitedByUserId.toString(),
  expiresAt: invitation.expiresAt,
  createdAt: invitation.createdAt,
});

const createMongooseInvitationRepository = (
  session?: ClientSession,
): InvitationRepository => ({
  async create(input) {
    try {
      const invitations = await InvitationModel.create(
        [input],
        session ? { session } : {},
      );
      const invitation = invitations[0];

      if (!invitation) {
        throw new Error("Invitation creation returned no document");
      }

      return toInvitationRecord(invitation.toObject<InvitationDocument>());
    } catch (error) {
      if (isDuplicateKeyError(error)) {
        throw new InvitationPersistenceConflictError({ cause: error });
      }

      throw error;
    }
  },

  async findById(invitationId) {
    const query =
      InvitationModel.findById(invitationId).lean<InvitationDocument>();

    if (session) {
      query.session(session);
    }

    const invitation = await query.exec();
    return invitation ? toInvitationRecord(invitation) : null;
  },

  async findByOrganizationAndUser(organizationId, userId) {
    const query = InvitationModel.findOne({
      organizationId,
      invitedUserId: userId,
    }).lean<InvitationDocument>();

    if (session) {
      query.session(session);
    }

    const invitation = await query.exec();
    return invitation ? toInvitationRecord(invitation) : null;
  },

  async findPendingByUser(userId, now) {
    const query = InvitationModel.find({
      invitedUserId: userId,
      expiresAt: { $gt: now },
    })
      .sort({ createdAt: -1 })
      .lean<InvitationDocument[]>();

    if (session) {
      query.session(session);
    }

    const invitations = await query.exec();
    return invitations.map(toInvitationRecord);
  },

  async deleteById(invitationId) {
    const query = InvitationModel.deleteOne({ _id: invitationId });

    if (session) {
      query.session(session);
    }

    const result = await query.exec();
    return result.deletedCount === 1;
  },

  async deleteByOrganizationAndUser(organizationId, userId) {
    const query = InvitationModel.deleteMany({
      organizationId,
      invitedUserId: userId,
    });

    if (session) {
      query.session(session);
    }

    const result = await query.exec();
    return result.deletedCount;
  },

  async deleteExpiredByOrganizationAndUser(organizationId, userId, now) {
    const query = InvitationModel.deleteMany({
      organizationId,
      invitedUserId: userId,
      expiresAt: { $lte: now },
    });

    if (session) {
      query.session(session);
    }

    const result = await query.exec();
    return result.deletedCount;
  },

  async deleteByOrganizationId(organizationId) {
    const query = InvitationModel.deleteMany({ organizationId });

    if (session) {
      query.session(session);
    }

    const result = await query.exec();
    return result.deletedCount;
  },
});

export default createMongooseInvitationRepository;
