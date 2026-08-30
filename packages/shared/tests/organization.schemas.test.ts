import assert from "node:assert/strict";
import { describe, test } from "node:test";

import {
  OrganizationVisibility,
  createOrganizationSchema,
  publicOrganizationDtoSchema,
  updateOrganizationLogoSchema,
  updateOrganizationSchema,
} from "../organizations/index.js";

describe("shared organization schemas", () => {
  test("normalizes create input and defaults to private visibility", () => {
    assert.deepEqual(
      createOrganizationSchema.parse({ name: "  Product Team  " }),
      {
        name: "Product Team",
        visibility: OrganizationVisibility.PRIVATE,
      },
    );
  });

  test("accepts public organizations and completed logo upload IDs", () => {
    const input = createOrganizationSchema.parse({
      name: "Community",
      logoUploadId: "507f1f77bcf86cd799439011",
      visibility: OrganizationVisibility.PUBLIC,
    });

    assert.equal(input.visibility, OrganizationVisibility.PUBLIC);
    assert.equal(input.logoUploadId, "507f1f77bcf86cd799439011");
  });

  test("rejects empty names, invalid logo uploads, URLs, and extra fields", () => {
    assert.equal(
      createOrganizationSchema.safeParse({ name: "  " }).success,
      false,
    );
    assert.equal(
      createOrganizationSchema.safeParse({
        name: "Team",
        logoUploadId: "invalid",
      }).success,
      false,
    );
    assert.equal(
      createOrganizationSchema.safeParse({
        name: "Team",
        logoUrl: "https://example.com/logo.png",
      }).success,
      false,
    );
    assert.equal(
      createOrganizationSchema.safeParse({ name: "Team", ownerId: "user" })
        .success,
      false,
    );
  });

  test("requires a nonempty metadata update and validates logo mutation IDs", () => {
    assert.equal(updateOrganizationSchema.safeParse({}).success, false);
    assert.equal(
      updateOrganizationSchema.safeParse({ logoUrl: null }).success,
      false,
    );
    assert.equal(
      updateOrganizationLogoSchema.safeParse({
        uploadId: "507f1f77bcf86cd799439011",
      }).success,
      true,
    );
  });

  test("requires nullable asset identity in organization responses", () => {
    const organization = {
      id: "507f1f77bcf86cd799439011",
      name: "Community",
      slug: "community",
      logoAssetId: null,
      visibility: OrganizationVisibility.PRIVATE,
      currentUserRole: "OWNER",
      createdAt: "2026-08-30T00:00:00.000Z",
      updatedAt: "2026-08-30T00:00:00.000Z",
    };
    assert.deepEqual(
      publicOrganizationDtoSchema.parse(organization),
      organization,
    );
    const sanitized = publicOrganizationDtoSchema.parse({
      ...organization,
      logoUrl: "https://example.com/logo.png",
    });
    assert.equal("logoUrl" in sanitized, false);
  });
});
