import assert from "node:assert/strict";
import http from "node:http";
import { after, before, describe, test } from "node:test";

import { OrganizationVisibility } from "@intouch/shared/organizations";
import type { RequestHandler } from "express";

import createApp from "../src/app.js";
import UnauthorizedError from "../src/errors/UnauthorizedError.js";
import type { AuthLocals } from "../src/modules/auth/auth.types.js";
import createInvitationController from "../src/modules/invitations/invitation.controller.js";
import { InvitationTargetNotFoundError } from "../src/modules/invitations/invitation.errors.js";
import createInvitationRouter from "../src/modules/invitations/invitation.routes.js";
import type { InvitationService } from "../src/modules/invitations/invitation.service.js";
import type { PublicInvitation } from "../src/modules/invitations/invitation.types.js";
import createMembershipController from "../src/modules/memberships/membership.controller.js";
import { MembershipConflictError } from "../src/modules/memberships/membership.errors.js";
import createOrganizationAccessRouter from "../src/modules/memberships/membership.routes.js";
import type { MembershipAccessService } from "../src/modules/memberships/membership.access.service.js";
import {
  MembershipRole,
  type MembershipRecord,
} from "../src/modules/memberships/membership.types.js";
import { OrganizationForbiddenError } from "../src/modules/organizations/organization.errors.js";

process.env.NODE_ENV = "test";

const userId = "507f1f77bcf86cd799439011";
const organizationId = "507f1f77bcf86cd799439012";
const invitationId = "507f1f77bcf86cd799439013";
const now = new Date("2026-07-30T00:00:00.000Z");
const membership: MembershipRecord = {
  id: "507f1f77bcf86cd799439014",
  userId,
  organizationId,
  role: MembershipRole.MEMBER,
  joinedAt: now,
};
const invitation: PublicInvitation = {
  id: invitationId,
  organizationId,
  invitedUserId: userId,
  invitedByUserId: "507f1f77bcf86cd799439015",
  expiresAt: new Date("2026-08-06T00:00:00.000Z"),
  createdAt: now,
  organization: {
    id: organizationId,
    name: "Product Team",
    slug: "product-team",
    logoAssetId: null,
    visibility: OrganizationVisibility.PRIVATE,
  },
};

let receivedEmail: string | undefined;
let createError: Error | undefined;
let joinError: Error | undefined;

const invitationService: InvitationService = {
  create: async (_userId, _organizationId, input) => {
    if (createError) {
      throw createError;
    }

    receivedEmail = input.email;
    return invitation;
  },
  listForUser: async () => [invitation],
  accept: async () => membership,
  decline: async () => undefined,
};
const membershipService: MembershipAccessService = {
  joinPublic: async () => {
    if (joinError) {
      throw joinError;
    }

    return membership;
  },
};
const requireAccessToken: RequestHandler = (req, res, next) => {
  if (req.get("authorization") !== "Bearer valid-token") {
    next(new UnauthorizedError());
    return;
  }

  (res.locals as AuthLocals).userId = userId;
  next();
};

let server: http.Server;
let baseUrl: string;

before(async () => {
  const invitationController = createInvitationController(invitationService);
  const membershipController = createMembershipController(membershipService);
  const organizationAccessRouter = createOrganizationAccessRouter(
    membershipController,
    invitationController,
    requireAccessToken,
  );
  const invitationRouter = createInvitationRouter(
    invitationController,
    requireAccessToken,
  );
  const app = createApp({ invitationRouter, organizationAccessRouter });

  server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, resolve));
  const address = server.address();
  assert.ok(address && typeof address !== "string");
  baseUrl = `http://127.0.0.1:${address.port}`;
});

after(async () => {
  await new Promise<void>((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
  });
});

const headers = {
  Authorization: "Bearer valid-token",
  "Content-Type": "application/json",
};

describe("membership and invitation routes", () => {
  test("requires authentication", async () => {
    const response = await fetch(`${baseUrl}/api/v1/invitations`);
    assert.equal(response.status, 401);
  });

  test("creates an invitation with normalized email", async () => {
    const response = await fetch(
      `${baseUrl}/api/v1/organizations/${organizationId}/invitations`,
      {
        method: "POST",
        headers,
        body: JSON.stringify({ email: " MEMBER@Example.COM " }),
      },
    );

    assert.equal(response.status, 201);
    assert.equal(receivedEmail, "member@example.com");
  });

  test("rejects invalid invitation input", async () => {
    const response = await fetch(
      `${baseUrl}/api/v1/organizations/${organizationId}/invitations`,
      {
        method: "POST",
        headers,
        body: JSON.stringify({ email: "invalid" }),
      },
    );

    assert.equal(response.status, 400);
  });

  test("joins a public organization", async () => {
    const response = await fetch(
      `${baseUrl}/api/v1/organizations/${organizationId}/join`,
      { method: "POST", headers },
    );
    const body = (await response.json()) as { membership: MembershipRecord };

    assert.equal(response.status, 201);
    assert.equal(body.membership.role, MembershipRole.MEMBER);
  });

  test("lists, accepts, and declines invitations", async () => {
    const listResponse = await fetch(`${baseUrl}/api/v1/invitations`, {
      headers,
    });
    const listBody = (await listResponse.json()) as {
      invitations: PublicInvitation[];
    };
    const acceptResponse = await fetch(
      `${baseUrl}/api/v1/invitations/${invitationId}/accept`,
      { method: "POST", headers },
    );
    const declineResponse = await fetch(
      `${baseUrl}/api/v1/invitations/${invitationId}`,
      { method: "DELETE", headers },
    );

    assert.equal(listResponse.status, 200);
    assert.equal(listBody.invitations[0]?.organization.name, "Product Team");
    assert.equal(acceptResponse.status, 201);
    assert.equal(declineResponse.status, 204);
  });

  test("maps owner, target, and membership failures to the standard envelope", async () => {
    createError = new OrganizationForbiddenError();

    try {
      const forbidden = await fetch(
        `${baseUrl}/api/v1/organizations/${organizationId}/invitations`,
        {
          method: "POST",
          headers,
          body: JSON.stringify({ email: "member@example.com" }),
        },
      );
      assert.equal(forbidden.status, 403);
    } finally {
      createError = undefined;
    }

    createError = new InvitationTargetNotFoundError();

    try {
      const missing = await fetch(
        `${baseUrl}/api/v1/organizations/${organizationId}/invitations`,
        {
          method: "POST",
          headers,
          body: JSON.stringify({ email: "missing@example.com" }),
        },
      );
      assert.equal(missing.status, 404);
    } finally {
      createError = undefined;
    }

    joinError = new MembershipConflictError();

    try {
      const conflict = await fetch(
        `${baseUrl}/api/v1/organizations/${organizationId}/join`,
        { method: "POST", headers },
      );
      const body = (await conflict.json()) as Record<string, unknown>;

      assert.equal(conflict.status, 409);
      assert.deepEqual(body, {
        success: false,
        error: {
          code: "CONFLICT",
          message: "User is already an organization member",
        },
      });
    } finally {
      joinError = undefined;
    }
  });
});
