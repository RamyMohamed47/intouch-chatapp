import assert from "node:assert/strict";
import http from "node:http";
import { after, before, describe, test } from "node:test";

import { OrganizationVisibility } from "@intouch/shared/organizations";
import type { RequestHandler } from "express";

import createApp from "../src/app.js";
import UnauthorizedError from "../src/errors/UnauthorizedError.js";
import type { AuthLocals } from "../src/modules/auth/auth.types.js";
import { MembershipRole } from "../src/modules/memberships/index.js";
import createOrganizationController from "../src/modules/organizations/organization.controller.js";
import {
  OrganizationForbiddenError,
  OrganizationNotFoundError,
} from "../src/modules/organizations/organization.errors.js";
import createOrganizationRouter from "../src/modules/organizations/organization.routes.js";
import type { OrganizationService } from "../src/modules/organizations/organization.service.js";
import type { PublicOrganization } from "../src/modules/organizations/organization.types.js";

process.env.NODE_ENV = "test";

const userId = "507f1f77bcf86cd799439011";
const organizationId = "507f1f77bcf86cd799439012";
const organization: PublicOrganization = {
  id: organizationId,
  name: "Product Team",
  slug: "product-team",
  visibility: OrganizationVisibility.PRIVATE,
  currentUserRole: MembershipRole.OWNER,
  createdAt: new Date("2026-07-30T00:00:00.000Z"),
  updatedAt: new Date("2026-07-30T00:00:00.000Z"),
};

let receivedCreateInput: unknown;
let receivedUpdateInput: unknown;
let deletedOrganizationId: string | undefined;
let getByIdError: Error | undefined;
let updateError: Error | undefined;

const service: OrganizationService = {
  create: async (_userId, input) => {
    receivedCreateInput = input;
    return organization;
  },
  listForUser: async () => [organization],
  getById: async () => {
    if (getByIdError) {
      throw getByIdError;
    }

    return organization;
  },
  update: async (_userId, _organizationId, input) => {
    if (updateError) {
      throw updateError;
    }

    receivedUpdateInput = input;
    return {
      ...organization,
      ...(input.name === undefined ? {} : { name: input.name }),
      ...(input.logoUrl === undefined || input.logoUrl === null
        ? {}
        : { logoUrl: input.logoUrl }),
      ...(input.visibility === undefined
        ? {}
        : { visibility: input.visibility }),
    };
  },
  delete: async (_userId, id) => {
    deletedOrganizationId = id;
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
  const controller = createOrganizationController(service);
  const router = createOrganizationRouter(controller, requireAccessToken);
  const app = createApp({ organizationRouter: router });

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

const authenticatedHeaders = {
  Authorization: "Bearer valid-token",
  "Content-Type": "application/json",
};

describe("organization routes", () => {
  test("requires an access token", async () => {
    const response = await fetch(`${baseUrl}/api/v1/organizations`);
    const body = (await response.json()) as Record<string, unknown>;

    assert.equal(response.status, 401);
    assert.deepEqual(body, {
      success: false,
      error: { code: "UNAUTHORIZED", message: "Unauthorized" },
    });
  });

  test("creates an organization with normalized input", async () => {
    const response = await fetch(`${baseUrl}/api/v1/organizations`, {
      method: "POST",
      headers: authenticatedHeaders,
      body: JSON.stringify({ name: "  Product Team  " }),
    });
    const body = (await response.json()) as {
      organization: PublicOrganization;
    };

    assert.equal(response.status, 201);
    assert.deepEqual(receivedCreateInput, {
      name: "Product Team",
      visibility: OrganizationVisibility.PRIVATE,
    });
    assert.equal(body.organization.slug, organization.slug);
  });

  test("lists the authenticated user's organizations", async () => {
    const response = await fetch(`${baseUrl}/api/v1/organizations`, {
      headers: authenticatedHeaders,
    });
    const body = (await response.json()) as {
      organizations: PublicOrganization[];
    };

    assert.equal(response.status, 200);
    assert.equal(body.organizations.length, 1);
    assert.equal(body.organizations[0]?.currentUserRole, MembershipRole.OWNER);
  });

  test("gets an organization by valid ID", async () => {
    const response = await fetch(
      `${baseUrl}/api/v1/organizations/${organizationId}`,
      { headers: authenticatedHeaders },
    );

    assert.equal(response.status, 200);
  });

  test("uses the standard not-found envelope for hidden organizations", async () => {
    getByIdError = new OrganizationNotFoundError();

    try {
      const response = await fetch(
        `${baseUrl}/api/v1/organizations/${organizationId}`,
        { headers: authenticatedHeaders },
      );
      const body = (await response.json()) as Record<string, unknown>;

      assert.equal(response.status, 404);
      assert.deepEqual(body, {
        success: false,
        error: { code: "NOT_FOUND", message: "Organization not found" },
      });
    } finally {
      getByIdError = undefined;
    }
  });

  test("rejects invalid IDs and empty updates", async () => {
    const invalidIdResponse = await fetch(
      `${baseUrl}/api/v1/organizations/not-an-id`,
      { headers: authenticatedHeaders },
    );
    const emptyUpdateResponse = await fetch(
      `${baseUrl}/api/v1/organizations/${organizationId}`,
      {
        method: "PATCH",
        headers: authenticatedHeaders,
        body: JSON.stringify({}),
      },
    );

    assert.equal(invalidIdResponse.status, 400);
    assert.equal(emptyUpdateResponse.status, 400);
  });

  test("updates supported fields", async () => {
    const response = await fetch(
      `${baseUrl}/api/v1/organizations/${organizationId}`,
      {
        method: "PATCH",
        headers: authenticatedHeaders,
        body: JSON.stringify({
          name: "New Name",
          logoUrl: null,
          visibility: OrganizationVisibility.PUBLIC,
        }),
      },
    );

    assert.equal(response.status, 200);
    assert.deepEqual(receivedUpdateInput, {
      name: "New Name",
      logoUrl: null,
      visibility: OrganizationVisibility.PUBLIC,
    });
  });

  test("returns forbidden when a visible organization cannot be modified", async () => {
    updateError = new OrganizationForbiddenError();

    try {
      const response = await fetch(
        `${baseUrl}/api/v1/organizations/${organizationId}`,
        {
          method: "PATCH",
          headers: authenticatedHeaders,
          body: JSON.stringify({ name: "Blocked Rename" }),
        },
      );
      const body = (await response.json()) as Record<string, unknown>;

      assert.equal(response.status, 403);
      assert.deepEqual(body, {
        success: false,
        error: {
          code: "FORBIDDEN",
          message: "You do not have permission to modify this organization",
        },
      });
    } finally {
      updateError = undefined;
    }
  });

  test("deletes an organization with no response body", async () => {
    const response = await fetch(
      `${baseUrl}/api/v1/organizations/${organizationId}`,
      { method: "DELETE", headers: authenticatedHeaders },
    );

    assert.equal(response.status, 204);
    assert.equal(await response.text(), "");
    assert.equal(deletedOrganizationId, organizationId);
  });
});
