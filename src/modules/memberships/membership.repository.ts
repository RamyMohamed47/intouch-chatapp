import type { ClientSession } from "mongoose";
import { Types } from "mongoose";

import MembershipModel from "./membership.model.js";
import type {
  CreateMembershipInput,
  Membership,
  MembershipRecord,
} from "./membership.types.js";

interface MembershipDocument extends Membership {
  _id: Types.ObjectId;
}

export class MembershipPersistenceConflictError extends Error {
  constructor(options?: ErrorOptions) {
    super("Membership already exists", options);
    this.name = "MembershipPersistenceConflictError";
  }
}

export interface MembershipRepository {
  create(input: CreateMembershipInput): Promise<MembershipRecord>;
  findByUserAndOrganization(
    userId: string,
    organizationId: string,
  ): Promise<MembershipRecord | null>;
  findByUser(userId: string): Promise<MembershipRecord[]>;
  findByOrganization(organizationId: string): Promise<MembershipRecord[]>;
  deleteByOrganizationId(organizationId: string): Promise<number>;
}

const isDuplicateKeyError = (error: unknown) =>
  typeof error === "object" &&
  error !== null &&
  "code" in error &&
  error.code === 11000;

const toMembershipRecord = (
  membership: MembershipDocument,
): MembershipRecord => ({
  id: membership._id.toString(),
  userId: membership.userId.toString(),
  organizationId: membership.organizationId.toString(),
  role: membership.role,
  joinedAt: membership.joinedAt,
});

const createMongooseMembershipRepository = (
  session?: ClientSession,
): MembershipRepository => ({
  async create(input) {
    try {
      const memberships = await MembershipModel.create(
        [input],
        session ? { session } : {},
      );
      const membership = memberships[0];

      if (!membership) {
        throw new Error("Membership creation returned no document");
      }

      return toMembershipRecord(membership.toObject<MembershipDocument>());
    } catch (error) {
      if (isDuplicateKeyError(error)) {
        throw new MembershipPersistenceConflictError({ cause: error });
      }

      throw error;
    }
  },

  async findByUserAndOrganization(userId, organizationId) {
    const query = MembershipModel.findOne({
      userId,
      organizationId,
    }).lean<MembershipDocument>();

    if (session) {
      query.session(session);
    }

    const membership = await query.exec();
    return membership ? toMembershipRecord(membership) : null;
  },

  async findByUser(userId) {
    const query = MembershipModel.find({ userId })
      .sort({ joinedAt: -1 })
      .lean<MembershipDocument[]>();

    if (session) {
      query.session(session);
    }

    const memberships = await query.exec();
    return memberships.map(toMembershipRecord);
  },

  async findByOrganization(organizationId) {
    const query = MembershipModel.find({ organizationId })
      .sort({ joinedAt: 1, _id: 1 })
      .lean<MembershipDocument[]>();

    if (session) {
      query.session(session);
    }

    return (await query.exec()).map(toMembershipRecord);
  },

  async deleteByOrganizationId(organizationId) {
    const query = MembershipModel.deleteMany({ organizationId });

    if (session) {
      query.session(session);
    }

    const result = await query.exec();
    return result.deletedCount;
  },
});

export default createMongooseMembershipRepository;
