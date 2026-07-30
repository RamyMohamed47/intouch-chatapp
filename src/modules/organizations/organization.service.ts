import { randomBytes } from "node:crypto";

import {
  type CreateOrganizationInput,
  type UpdateOrganizationInput,
} from "@intouch/shared/organizations";

import {
  MembershipPersistenceConflictError,
  type MembershipRecord,
  type MembershipService,
} from "../memberships/index.js";
import {
  OrganizationConflictError,
  OrganizationNotFoundError,
} from "./organization.errors.js";
import {
  OrganizationSlugConflictError,
  type OrganizationRepository,
} from "./organization.repository.js";
import type { OrganizationPolicy } from "./organization.policy.js";
import type {
  OrganizationRecord,
  PublicOrganization,
} from "./organization.types.js";
import type { OrganizationUnitOfWork } from "./organization.unit-of-work.js";

const DEFAULT_MAX_SLUG_ATTEMPTS = 5;
const MAX_SLUG_LENGTH = 100;

export interface OrganizationServiceDependencies {
  organizations: OrganizationRepository;
  memberships: MembershipService;
  unitOfWork: OrganizationUnitOfWork;
  policy: OrganizationPolicy;
  createSlugSuffix?: () => string;
  maxSlugAttempts?: number;
}

const normalizeSlug = (name: string) => {
  const slug = name
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, MAX_SLUG_LENGTH)
    .replace(/-+$/g, "");

  return slug || "organization";
};

const defaultCreateSlugSuffix = () => randomBytes(4).toString("hex");

const withCurrentUserRole = (
  organization: OrganizationRecord,
  membership: MembershipRecord | null,
): PublicOrganization => {
  const result: PublicOrganization = {
    id: organization.id,
    name: organization.name,
    slug: organization.slug,
    visibility: organization.visibility,
    currentUserRole: membership?.role ?? null,
    createdAt: organization.createdAt,
    updatedAt: organization.updatedAt,
  };

  if (organization.logoUrl) {
    result.logoUrl = organization.logoUrl;
  }

  return result;
};

const createOrganizationService = ({
  organizations,
  memberships,
  unitOfWork,
  policy,
  createSlugSuffix = defaultCreateSlugSuffix,
  maxSlugAttempts = DEFAULT_MAX_SLUG_ATTEMPTS,
}: OrganizationServiceDependencies) => ({
  async create(userId: string, input: CreateOrganizationInput) {
    const baseSlug = normalizeSlug(input.name);

    for (let attempt = 0; attempt < maxSlugAttempts; attempt += 1) {
      const slug =
        attempt === 0
          ? baseSlug
          : `${baseSlug.slice(0, 91)}-${createSlugSuffix()}`;

      try {
        return await unitOfWork.run(async (context) => {
          const organization = await context.organizations.create({
            name: input.name,
            slug,
            ...(input.logoUrl ? { logoUrl: input.logoUrl } : {}),
            visibility: input.visibility,
          });
          const membership = await context.memberships.createOwner(
            userId,
            organization.id,
          );

          return withCurrentUserRole(organization, membership);
        });
      } catch (error) {
        if (error instanceof OrganizationSlugConflictError) {
          continue;
        }

        if (error instanceof MembershipPersistenceConflictError) {
          throw new OrganizationConflictError(
            "Organization owner membership conflicts with existing data",
          );
        }

        throw error;
      }
    }

    throw new OrganizationConflictError(
      "A unique organization slug could not be generated",
    );
  },

  async listForUser(userId: string) {
    const userMemberships = await memberships.listForUser(userId);
    const roleByOrganizationId = new Map(
      userMemberships.map((membership) => [
        membership.organizationId,
        membership,
      ]),
    );
    const userOrganizations = await organizations.findByIds([
      ...roleByOrganizationId.keys(),
    ]);

    return userOrganizations.map((organization) =>
      withCurrentUserRole(
        organization,
        roleByOrganizationId.get(organization.id) ?? null,
      ),
    );
  },

  async getById(userId: string, organizationId: string) {
    const organization = await organizations.findById(organizationId);
    const membership = await memberships.findForUser(userId, organizationId);
    const visibleOrganization = policy.assertVisible(organization, membership);

    return withCurrentUserRole(visibleOrganization, membership);
  },

  async update(
    userId: string,
    organizationId: string,
    input: UpdateOrganizationInput,
  ) {
    const organization = await organizations.findById(organizationId);
    const membership = await memberships.findForUser(userId, organizationId);
    policy.assertOwner(organization, membership);

    const updatedOrganization = await organizations.updateById(
      organizationId,
      input,
    );

    if (!updatedOrganization) {
      throw new OrganizationNotFoundError();
    }

    return withCurrentUserRole(updatedOrganization, membership);
  },

  async delete(userId: string, organizationId: string) {
    await unitOfWork.run(async (context) => {
      const organization = await context.organizations.findById(organizationId);
      const membership = await context.memberships.findForUser(
        userId,
        organizationId,
      );
      policy.assertOwner(organization, membership);

      await context.memberships.deleteForOrganization(organizationId);
      await context.invitations.deleteByOrganizationId(organizationId);
      const deleted = await context.organizations.deleteById(organizationId);

      if (!deleted) {
        throw new OrganizationNotFoundError();
      }
    });
  },
});

export type OrganizationService = ReturnType<typeof createOrganizationService>;

export { normalizeSlug };
export default createOrganizationService;
