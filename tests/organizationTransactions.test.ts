import assert from "node:assert/strict";
import { after, before, beforeEach, describe, test } from "node:test";

import { OrganizationVisibility } from "@intouch/shared/organizations";
import { MongoMemoryReplSet } from "mongodb-memory-server";
import mongoose from "mongoose";

import {
  InvitationModel,
  createInvitationService,
  createMongooseInvitationRepository,
} from "../src/modules/invitations/index.js";
import {
  MembershipModel,
  createMembershipAccessService,
  createMembershipService,
  createMongooseMembershipRepository,
  type MembershipService,
} from "../src/modules/memberships/index.js";
import OrganizationModel from "../src/modules/organizations/organization.model.js";
import createOrganizationPolicy from "../src/modules/organizations/organization.policy.js";
import createMongooseOrganizationRepository from "../src/modules/organizations/organization.repository.js";
import createOrganizationService from "../src/modules/organizations/organization.service.js";
import createMongooseOrganizationUnitOfWork, {
  type OrganizationUnitOfWork,
} from "../src/modules/organizations/organization.unit-of-work.js";
import type { UserRepository } from "../src/modules/user/user.repository.js";
import { UserStatus, type PublicUser } from "../src/modules/user/user.types.js";
import { emptyCommunicationContext } from "./unitOfWorkContext.js";

const userId = "507f1f77bcf86cd799439011";
const invitedUserId = "507f1f77bcf86cd799439099";
const now = new Date("2026-07-30T00:00:00.000Z");
let replicaSet: MongoMemoryReplSet;

before(async () => {
  replicaSet = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
  await mongoose.connect(replicaSet.getUri("intouch"));
  await Promise.all([
    OrganizationModel.syncIndexes(),
    MembershipModel.syncIndexes(),
    InvitationModel.syncIndexes(),
  ]);
});

beforeEach(async () => {
  await Promise.all([
    OrganizationModel.deleteMany({}).exec(),
    MembershipModel.deleteMany({}).exec(),
    InvitationModel.deleteMany({}).exec(),
  ]);
});

after(async () => {
  await mongoose.disconnect();
  await replicaSet.stop();
});

const createService = (unitOfWork: OrganizationUnitOfWork) =>
  createOrganizationService({
    organizations: createMongooseOrganizationRepository(),
    memberships: createMembershipService(createMongooseMembershipRepository()),
    unitOfWork,
    policy: createOrganizationPolicy(),
  });

const invitedUser: PublicUser = {
  id: invitedUserId,
  username: "invited_user",
  displayName: "Invited User",
  email: "invited@example.com",
  status: UserStatus.OFFLINE,
  createdAt: now,
  updatedAt: now,
};
const users: UserRepository = {
  hasIdentityConflict: async () => false,
  createPasswordUser: async () => invitedUser,
  createGoogleUser: async () => invitedUser,
  findPasswordUserByEmail: async () => null,
  findPublicByEmail: async () => invitedUser,
  findPublicById: async () => invitedUser,
  findPublicByIds: async () => [invitedUser],
  linkGoogleProvider: async () => invitedUser,
  touchPasswordProvider: async () => undefined,
  useGoogleProvider: async () => invitedUser,
  usernameExists: async () => false,
};

describe("organization transactions", () => {
  test("commits organization and owner membership together", async () => {
    const result = await createService(
      createMongooseOrganizationUnitOfWork(),
    ).create(userId, {
      name: "Product Team",
      visibility: OrganizationVisibility.PRIVATE,
    });

    assert.equal(await OrganizationModel.countDocuments(), 1);
    assert.equal(await MembershipModel.countDocuments(), 1);
    assert.equal(result.currentUserRole, "OWNER");
  });

  test("rolls back organization creation when owner creation fails", async () => {
    const unitOfWork: OrganizationUnitOfWork = {
      run: (work) =>
        mongoose.connection.transaction((session) => {
          const failingMemberships: MembershipService = {
            createOwner: async () => {
              throw new Error("forced owner failure");
            },
            createMember: async () => {
              throw new Error("unused");
            },
            findForUser: async () => null,
            listForUser: async () => [],
            listForOrganization: async () => [],
            deleteForOrganization: async () => 0,
          };

          return work({
            ...emptyCommunicationContext,
            organizations: createMongooseOrganizationRepository(session),
            memberships: failingMemberships,
            invitations: createMongooseInvitationRepository(session),
          });
        }),
    };

    await assert.rejects(
      createService(unitOfWork).create(userId, {
        name: "Rollback Team",
        visibility: OrganizationVisibility.PRIVATE,
      }),
      /forced owner failure/,
    );
    assert.equal(await OrganizationModel.countDocuments(), 0);
    assert.equal(await MembershipModel.countDocuments(), 0);
  });

  test("rolls back membership deletion when organization deletion fails", async () => {
    const created = await createService(
      createMongooseOrganizationUnitOfWork(),
    ).create(userId, {
      name: "Persistent Team",
      visibility: OrganizationVisibility.PRIVATE,
    });
    const failingDeleteUnitOfWork: OrganizationUnitOfWork = {
      run: (work) =>
        mongoose.connection.transaction((session) => {
          const organizations = createMongooseOrganizationRepository(session);

          return work({
            ...emptyCommunicationContext,
            organizations: {
              ...organizations,
              deleteById: async () => {
                throw new Error("forced organization delete failure");
              },
            },
            memberships: createMembershipService(
              createMongooseMembershipRepository(session),
            ),
            invitations: createMongooseInvitationRepository(session),
          });
        }),
    };

    await assert.rejects(
      createService(failingDeleteUnitOfWork).delete(userId, created.id),
      /forced organization delete failure/,
    );
    assert.equal(await OrganizationModel.countDocuments(), 1);
    assert.equal(await MembershipModel.countDocuments(), 1);
  });

  test("deletes pending invitations with the organization", async () => {
    const service = createService(createMongooseOrganizationUnitOfWork());
    const created = await service.create(userId, {
      name: "Disposable Team",
      visibility: OrganizationVisibility.PRIVATE,
    });
    await createMongooseInvitationRepository().create({
      organizationId: created.id,
      invitedUserId,
      invitedByUserId: userId,
      expiresAt: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000),
    });

    await service.delete(userId, created.id);

    assert.equal(await OrganizationModel.countDocuments(), 0);
    assert.equal(await MembershipModel.countDocuments(), 0);
    assert.equal(await InvitationModel.countDocuments(), 0);
  });

  test("rolls back accepted membership when invitation consumption fails", async () => {
    const created = await createService(
      createMongooseOrganizationUnitOfWork(),
    ).create(userId, {
      name: "Invite Team",
      visibility: OrganizationVisibility.PRIVATE,
    });
    const invitation = await createMongooseInvitationRepository().create({
      organizationId: created.id,
      invitedUserId,
      invitedByUserId: userId,
      expiresAt: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000),
    });
    const failingUnitOfWork: OrganizationUnitOfWork = {
      run: (work) =>
        mongoose.connection.transaction((session) => {
          const invitations = createMongooseInvitationRepository(session);

          return work({
            ...emptyCommunicationContext,
            organizations: createMongooseOrganizationRepository(session),
            memberships: createMembershipService(
              createMongooseMembershipRepository(session),
            ),
            invitations: {
              ...invitations,
              deleteById: async () => {
                throw new Error("forced invitation consumption failure");
              },
            },
          });
        }),
    };
    const service = createInvitationService({
      invitations: createMongooseInvitationRepository(),
      organizations: createMongooseOrganizationRepository(),
      policy: createOrganizationPolicy(),
      unitOfWork: failingUnitOfWork,
      users,
      now: () => now,
    });

    await assert.rejects(
      service.accept(invitedUserId, invitation.id),
      /forced invitation consumption failure/,
    );
    assert.equal(await MembershipModel.countDocuments(), 1);
    assert.equal(await InvitationModel.countDocuments(), 1);
  });

  test("rolls back public membership when invitation cleanup fails", async () => {
    const created = await createService(
      createMongooseOrganizationUnitOfWork(),
    ).create(userId, {
      name: "Public Team",
      visibility: OrganizationVisibility.PUBLIC,
    });
    const failingUnitOfWork: OrganizationUnitOfWork = {
      run: (work) =>
        mongoose.connection.transaction((session) => {
          const invitations = createMongooseInvitationRepository(session);

          return work({
            ...emptyCommunicationContext,
            organizations: createMongooseOrganizationRepository(session),
            memberships: createMembershipService(
              createMongooseMembershipRepository(session),
            ),
            invitations: {
              ...invitations,
              deleteByOrganizationAndUser: async () => {
                throw new Error("forced invitation cleanup failure");
              },
            },
          });
        }),
    };
    const service = createMembershipAccessService({
      policy: createOrganizationPolicy(),
      unitOfWork: failingUnitOfWork,
    });

    await assert.rejects(
      service.joinPublic(invitedUserId, created.id),
      /forced invitation cleanup failure/,
    );
    assert.equal(await MembershipModel.countDocuments(), 1);
  });

  test("allows only one concurrent public join", async () => {
    const created = await createService(
      createMongooseOrganizationUnitOfWork(),
    ).create(userId, {
      name: "Concurrent Team",
      visibility: OrganizationVisibility.PUBLIC,
    });
    const service = createMembershipAccessService({
      policy: createOrganizationPolicy(),
      unitOfWork: createMongooseOrganizationUnitOfWork(),
    });
    const results = await Promise.allSettled([
      service.joinPublic(invitedUserId, created.id),
      service.joinPublic(invitedUserId, created.id),
    ]);

    assert.equal(
      results.filter((result) => result.status === "fulfilled").length,
      1,
    );
    assert.equal(
      results.filter((result) => result.status === "rejected").length,
      1,
    );
    assert.equal(await MembershipModel.countDocuments(), 2);
  });
});
