import assert from "node:assert/strict";
import { describe, test } from "node:test";

import {
  createMessageSchema,
  messageHistoryQuerySchema,
} from "../messages/index.js";

describe("shared message schemas", () => {
  test("preserves content formatting and normalizes cursor limits", () => {
    assert.deepEqual(createMessageSchema.parse({ content: "  hello\n" }), {
      content: "  hello\n",
    });
    assert.deepEqual(messageHistoryQuerySchema.parse({ limit: "25" }), {
      limit: 25,
    });
    assert.deepEqual(messageHistoryQuerySchema.parse({}), { limit: 50 });
  });

  test("rejects whitespace, oversized content, and invalid limits", () => {
    assert.equal(
      createMessageSchema.safeParse({ content: " \n\t" }).success,
      false,
    );
    assert.equal(
      createMessageSchema.safeParse({ content: "a".repeat(4_001) }).success,
      false,
    );
    assert.equal(
      messageHistoryQuerySchema.safeParse({ limit: 101 }).success,
      false,
    );
  });
});
