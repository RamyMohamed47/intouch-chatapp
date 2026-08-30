import assert from "node:assert/strict";
import { describe, test } from "node:test";

import { OrganizationVisibility } from "@intouch/shared/organizations";
import { UploadPurpose } from "@intouch/shared/uploads";

import type { InvitationRepository } from "../src/modules/invitations/index.js";
import {
  MembershipRole,
  type MembershipRecord,
  type MembershipService,
} from "../src/modules/memberships/index.js";
import {
  OrganizationForbiddenError,
  OrganizationNotFoundError,
} from "../src/modules/organizations/organization.errors.js";
import {
  OrganizationSlugConflictError,
  type OrganizationRepository,
} from "../src/modules/organizations/organization.repository.js";
import createOrganizationPolicy from "../src/modules/organizations/organization.policy.js";
import createOrganizationService from "../src/modules/organizations/organization.service.js";
import type { OrganizationRecord } from "../src/modules/organizations/organization.types.js";
import type { OrganizationUnitOfWork } from "../src/modules/organizations/organization.unit-of-work.js";
import type { StoredAssetRepository } from "../src/modules/uploads/upload.repository.js";
import {
  StoredAssetStatus,
  type StoredAssetRecord,
} from "../src/modules/uploads/upload.types.js";
import { emptyCommunicationContext } from "./unitOfWorkContext.js";

const userId = "507f1f77bcf86cd799439011";
const organizationId = "507f1f77bcf86cd799439012";
const now = new Date("2026-07-30T00:00:00.000Z");
const logoUploadId = "507f1f77bcf86cd799439099";

const logoAsset = (): StoredAssetRecord => ({
  id: logoUploadId,
  ownerUserId: userId,
  organizationId,
  purpose: UploadPurpose.ORGANIZATION_LOGO,
  status: StoredAssetStatus.READY,
  objectKey: "organization-logos/random",
  fileName: "organization.webp",
  declaredContentType: "image/webp",
  declaredSize: 1024,
  verifiedContentType: "image/webp",
  verifiedSize: 1024,
  kind: "IMAGE",
  cleanupAttempts: 0,
  cleanupAvailableAt: now,
  createdAt: now,
  updatedAt: now,
});

const organization = (
  overrides: Partial<OrganizationRecord> = {},
): OrganizationRecord => ({
  id: organizationId,
  name: "Product Team",
  slug: "product-team",
  visibility: OrganizationVisibility.PRIVATE,
  createdAt: now,
  updatedAt: now,
  ...overrides,
});

const membership = (
  role: MembershipRecord["role"] = MembershipRole.OWNER,
): MembershipRecord => ({
  id: "507f1f77bcf86cd799439013",
  userId,
  organizationId,
  role,
  joinedAt: now,
});

const createOrganizationRepository = (
  overrides: Partial<OrganizationRepository> = {},
): OrganizationRepository => ({
  create: async (input) => organization(input),
  findById: async () => organization(),
  findByIds: async () => [organization()],
  lockForMutation: async () => true,
  updateById: async (_id, input) =>
    organization({
      ...(input.name === undefined ? {} : { name: input.name }),
      ...(input.visibility === undefined
        ? {}
        : { visibility: input.visibility }),
    }),
  replaceLogoAsset: async (_id, logoAssetId) => ({
    organization: organization({
      ...(logoAssetId ? { logoAssetId } : {}),
    }),
    previousLogoAssetId: null,
  }),
  deleteById: async () => true,
  ...overrides,
});

const createMemberships = (
  overrides: Partial<MembershipService> = {},
): MembershipService => ({
  createOwner: async () => membership(),
  createMember: async () => membership(MembershipRole.MEMBER),
  findForUser: async () => membership(),
  listForUser: async () => [membership()],
  listForOrganization: async () => [membership()],
  deleteForOrganization: async () => 1,
  ...overrides,
});

const invitations: InvitationRepository = {
  create: async () => {
    throw new Error("unused");
  },
  findById: async () => null,
  findByOrganizationAndUser: async () => null,
  findPendingByUser: async () => [],
  deleteById: async () => false,
  deleteByOrganizationAndUser: async () => 0,
  deleteExpiredByOrganizationAndUser: async () => 0,
  deleteByOrganizationId: async () => 0,
};

const createUnitOfWork = (
  organizations: OrganizationRepository,
  memberships: MembershipService,
  assets: StoredAssetRepository = emptyCommunicationContext.assets,
): OrganizationUnitOfWork => ({
  run: (work) =>
    work({
      ...emptyCommunicationContext,
      organizations,
      memberships,
      invitations,
      assets,
    }),
});

const createService = (
  organizations = createOrganizationRepository(),
  memberships = createMemberships(),
  unitOfWork = createUnitOfWork(organizations, memberships),
) =>
  createOrganizationService({
    organizations,
    memberships,
    unitOfWork,
    policy: createOrganizationPolicy(),
    createSlugSuffix: () => "deadbeef",
  });

describe("organization service", () => {
  test("creates the organization and owner in one unit of work", async () => {
    const events: string[] = [];
    const organizations = createOrganizationRepository({
      create: async (input) => {
        events.push(`organization:${input.slug}`);
        return organization(input);
      },
    });
    const memberships = createMemberships({
      createOwner: async (ownerId, createdOrganizationId) => {
        events.push(`owner:${ownerId}:${createdOrganizationId}`);
        return membership();
      },
    });
    const result = await createService(
      organizations,
      memberships,
      createUnitOfWork(organizations, memberships),
    ).create(userId, {
      name: "Product Team",
      visibility: OrganizationVisibility.PRIVATE,
    });

    assert.deepEqual(events, [
      "organization:product-team",
      `owner:${userId}:${organizationId}`,
    ]);
    assert.equal(result.currentUserRole, MembershipRole.OWNER);
  });

  test("retries the complete transaction after a slug collision", async () => {
    const attemptedSlugs: string[] = [];
    const organizations = createOrganizationRepository({
      create: async (input) => {
        attemptedSlugs.push(input.slug);

        if (attemptedSlugs.length === 1) {
          throw new OrganizationSlugConflictError();
        }

        return organization(input);
      },
    });
    const memberships = createMemberships();

    const result = await createService(
      organizations,
      memberships,
      createUnitOfWork(organizations, memberships),
    ).create(userId, {
      name: "Crème brûlée",
      visibility: OrganizationVisibility.PUBLIC,
    });

    assert.deepEqual(attemptedSlugs, ["creme-brulee", "creme-brulee-deadbeef"]);
    assert.equal(result.slug, "creme-brulee-deadbeef");
  });

  test("claims an optional logo in the organization creation unit of work", async () => {
    const events: string[] = [];
    const organizations = createOrganizationRepository({
      replaceLogoAsset: async (_id, assetId) => {
        events.push(`logo:${assetId}`);
        return {
          organization: organization(assetId ? { logoAssetId: assetId } : {}),
          previousLogoAssetId: null,
        };
      },
    });
    const memberships = createMemberships();
    const assets: StoredAssetRepository = {
      ...emptyCommunicationContext.assets,
      claimOrganizationLogo: async (input) => {
        events.push(`claim:${input.assetId}:${input.organizationId}`);
        return logoAsset();
      },
    };

    const result = await createService(
      organizations,
      memberships,
      createUnitOfWork(organizations, memberships, assets),
    ).create(userId, {
      name: "Product Team",
      visibility: OrganizationVisibility.PRIVATE,
      logoUploadId,
    });

    assert.deepEqual(events, [
      `claim:${logoUploadId}:${organizationId}`,
      `logo:${logoUploadId}`,
    ]);
    assert.equal(result.logoAssetId, logoUploadId);
  });

  test("lists only organizations represented by the user's memberships", async () => {
    const member = membership(MembershipRole.MEMBER);
    const organizations = createOrganizationRepository({
      findByIds: async (ids) => {
        assert.deepEqual(ids, [organizationId]);
        return [organization()];
      },
    });
    const memberships = createMemberships({
      listForUser: async () => [member],
    });
    const result = await createService(organizations, memberships).listForUser(
      userId,
    );

    assert.equal(result.length, 1);
    assert.equal(result[0]?.currentUserRole, MembershipRole.MEMBER);
  });

  test("hides private organizations from non-members", async () => {
    const memberships = createMemberships({ findForUser: async () => null });

    await assert.rejects(
      createService(createOrganizationRepository(), memberships).getById(
        userId,
        organizationId,
      ),
      OrganizationNotFoundError,
    );
  });

  test("allows authenticated non-members to view public organizations", async () => {
    const organizations = createOrganizationRepository({
      findById: async () =>
        organization({ visibility: OrganizationVisibility.PUBLIC }),
    });
    const memberships = createMemberships({ findForUser: async () => null });
    const result = await createService(organizations, memberships).getById(
      userId,
      organizationId,
    );

    assert.equal(result.currentUserRole, null);
  });

  test("allows only owners to update or delete", async () => {
    const memberships = createMemberships({
      findForUser: async () => membership(MembershipRole.MEMBER),
    });
    const service = createService(createOrganizationRepository(), memberships);

    await assert.rejects(
      service.update(userId, organizationId, { name: "Renamed" }),
      OrganizationForbiddenError,
    );
    await assert.rejects(
      service.delete(userId, organizationId),
      OrganizationForbiddenError,
    );
    await assert.rejects(
      service.setLogo(userId, organizationId, logoUploadId),
      OrganizationForbiddenError,
    );
    await assert.rejects(
      service.removeLogo(userId, organizationId),
      OrganizationForbiddenError,
    );
  });

  test("updates organization fields without changing the slug", async () => {
    const result = await createService().update(userId, organizationId, {
      name: "Renamed Team",
      visibility: OrganizationVisibility.PUBLIC,
    });

    assert.equal(result.name, "Renamed Team");
    assert.equal(result.slug, "product-team");
    assert.equal(result.visibility, OrganizationVisibility.PUBLIC);
    assert.equal(result.logoAssetId, null);
  });

  test("replaces and removes logos while scheduling old assets for cleanup", async () => {
    const oldLogoId = "507f1f77bcf86cd799439088";
    const deletedAssets: string[] = [];
    let activeLogoId: string | null = oldLogoId;
    const organizations = createOrganizationRepository({
      findById: async () =>
        organization(activeLogoId ? { logoAssetId: activeLogoId } : {}),
      replaceLogoAsset: async (_id, assetId) => {
        const previousLogoAssetId = activeLogoId;
        activeLogoId = assetId;
        return {
          organization: organization(
            activeLogoId ? { logoAssetId: activeLogoId } : {},
          ),
          previousLogoAssetId,
        };
      },
    });
    const memberships = createMemberships();
    const assets: StoredAssetRepository = {
      ...emptyCommunicationContext.assets,
      claimOrganizationLogo: async () => logoAsset(),
      markClaimedForDeletion: async (assetId) => {
        deletedAssets.push(assetId);
        return true;
      },
    };
    const service = createService(
      organizations,
      memberships,
      createUnitOfWork(organizations, memberships, assets),
    );

    const replaced = await service.setLogo(
      userId,
      organizationId,
      logoUploadId,
    );
    const removed = await service.removeLogo(userId, organizationId);

    assert.equal(replaced.logoAssetId, logoUploadId);
    assert.equal(removed.logoAssetId, null);
    assert.deepEqual(deletedAssets, [oldLogoId, logoUploadId]);
  });
});
