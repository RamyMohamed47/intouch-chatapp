import assert from "node:assert/strict";
import { describe, test } from "node:test";

import { inviteMemberSchema } from "../memberships/index.js";

describe("shared membership schemas", () => {
  test("normalizes an invitation email", () => {
    assert.deepEqual(
      inviteMemberSchema.parse({ email: "  MEMBER@Example.COM  " }),
      { email: "member@example.com" },
    );
  });

  test("rejects invalid emails and unknown fields", () => {
    assert.equal(
      inviteMemberSchema.safeParse({ email: "invalid" }).success,
      false,
    );
    assert.equal(
      inviteMemberSchema.safeParse({
        email: "member@example.com",
        role: "OWNER",
      }).success,
      false,
    );
  });
});
