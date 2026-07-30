import type { ClientSession } from "mongoose";
import { Types } from "mongoose";

import OrganizationModel from "./organization.model.js";
import type {
  CreateOrganizationRecordInput,
  Organization,
  OrganizationRecord,
  UpdateOrganizationRecordInput,
} from "./organization.types.js";

interface OrganizationDocument extends Organization {
  _id: Types.ObjectId;
}

export class OrganizationSlugConflictError extends Error {
  constructor(options?: ErrorOptions) {
    super("Organization slug already exists", options);
    this.name = "OrganizationSlugConflictError";
  }
}

export interface OrganizationRepository {
  create(input: CreateOrganizationRecordInput): Promise<OrganizationRecord>;
  findById(organizationId: string): Promise<OrganizationRecord | null>;
  findByIds(organizationIds: readonly string[]): Promise<OrganizationRecord[]>;
  updateById(
    organizationId: string,
    input: UpdateOrganizationRecordInput,
  ): Promise<OrganizationRecord | null>;
  deleteById(organizationId: string): Promise<boolean>;
}

const isDuplicateKeyError = (error: unknown) =>
  typeof error === "object" &&
  error !== null &&
  "code" in error &&
  error.code === 11000;

const toOrganizationRecord = (
  organization: OrganizationDocument,
): OrganizationRecord => {
  const record: OrganizationRecord = {
    id: organization._id.toString(),
    name: organization.name,
    slug: organization.slug,
    visibility: organization.visibility,
    createdAt: organization.createdAt,
    updatedAt: organization.updatedAt,
  };

  if (organization.logoUrl) {
    record.logoUrl = organization.logoUrl;
  }

  return record;
};

const createMongooseOrganizationRepository = (
  session?: ClientSession,
): OrganizationRepository => ({
  async create(input) {
    try {
      const organizations = await OrganizationModel.create(
        [input],
        session ? { session } : {},
      );
      const organization = organizations[0];

      if (!organization) {
        throw new Error("Organization creation returned no document");
      }

      return toOrganizationRecord(
        organization.toObject<OrganizationDocument>(),
      );
    } catch (error) {
      if (isDuplicateKeyError(error)) {
        throw new OrganizationSlugConflictError({ cause: error });
      }

      throw error;
    }
  },

  async findById(organizationId) {
    const query =
      OrganizationModel.findById(organizationId).lean<OrganizationDocument>();

    if (session) {
      query.session(session);
    }

    const organization = await query.exec();
    return organization ? toOrganizationRecord(organization) : null;
  },

  async findByIds(organizationIds) {
    if (organizationIds.length === 0) {
      return [];
    }

    const query = OrganizationModel.find({ _id: { $in: organizationIds } })
      .sort({ createdAt: -1 })
      .lean<OrganizationDocument[]>();

    if (session) {
      query.session(session);
    }

    const organizations = await query.exec();
    return organizations.map(toOrganizationRecord);
  },

  async updateById(organizationId, input) {
    const set: Record<string, unknown> = {};

    if (input.name !== undefined) {
      set.name = input.name;
    }
    if (input.logoUrl !== undefined && input.logoUrl !== null) {
      set.logoUrl = input.logoUrl;
    }
    if (input.visibility !== undefined) {
      set.visibility = input.visibility;
    }

    const update = {
      ...(Object.keys(set).length > 0 ? { $set: set } : {}),
      ...(input.logoUrl === null ? { $unset: { logoUrl: 1 } } : {}),
    };
    const query = OrganizationModel.findByIdAndUpdate(organizationId, update, {
      new: true,
      runValidators: true,
    }).lean<OrganizationDocument>();

    if (session) {
      query.session(session);
    }

    const organization = await query.exec();
    return organization ? toOrganizationRecord(organization) : null;
  },

  async deleteById(organizationId) {
    const query = OrganizationModel.deleteOne({ _id: organizationId });

    if (session) {
      query.session(session);
    }

    const result = await query.exec();
    return result.deletedCount === 1;
  },
});

export default createMongooseOrganizationRepository;
