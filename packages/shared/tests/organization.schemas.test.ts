import assert from "node:assert/strict";
import { describe, test } from "node:test";

import {
  OrganizationVisibility,
  createOrganizationSchema,
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

  test("accepts public organizations and HTTP(S) logos", () => {
    const input = createOrganizationSchema.parse({
      name: "Community",
      logoUrl: "https://cdn.example.com/logo.png",
      visibility: OrganizationVisibility.PUBLIC,
    });

    assert.equal(input.visibility, OrganizationVisibility.PUBLIC);
    assert.equal(input.logoUrl, "https://cdn.example.com/logo.png");
  });

  test("rejects empty names, non-HTTP logos, and extra fields", () => {
    assert.equal(
      createOrganizationSchema.safeParse({ name: "  " }).success,
      false,
    );
    assert.equal(
      createOrganizationSchema.safeParse({
        name: "Team",
        logoUrl: "ftp://example.com/logo.png",
      }).success,
      false,
    );
    assert.equal(
      createOrganizationSchema.safeParse({ name: "Team", ownerId: "user" })
        .success,
      false,
    );
  });

  test("requires a nonempty update and allows logo removal", () => {
    assert.equal(updateOrganizationSchema.safeParse({}).success, false);
    assert.deepEqual(updateOrganizationSchema.parse({ logoUrl: null }), {
      logoUrl: null,
    });
  });
});
