import assert from "node:assert/strict";
import { describe, test } from "node:test";

import {
  conversationSocketSchema,
  organizationSocketSchema,
} from "../realtime/index.js";

describe("shared realtime schemas", () => {
  test("accepts strict conversation and organization socket payloads", () => {
    const id = "507f1f77bcf86cd799439011";
    assert.deepEqual(conversationSocketSchema.parse({ conversationId: id }), {
      conversationId: id,
    });
    assert.deepEqual(organizationSocketSchema.parse({ organizationId: id }), {
      organizationId: id,
    });
    assert.equal(
      conversationSocketSchema.safeParse({ conversationId: id, extra: true })
        .success,
      false,
    );
  });
});
