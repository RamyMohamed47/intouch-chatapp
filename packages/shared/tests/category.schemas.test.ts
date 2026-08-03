import assert from "node:assert/strict";
import { describe, test } from "node:test";

import {
  createCategorySchema,
  updateCategorySchema,
} from "../categories/index.js";

describe("shared category schemas", () => {
  test("trims names and accepts zero-based positions", () => {
    assert.deepEqual(createCategorySchema.parse({ name: "  Product  " }), {
      name: "Product",
    });
    assert.deepEqual(updateCategorySchema.parse({ position: 0 }), {
      position: 0,
    });
  });

  test("rejects empty updates, empty names, and unknown fields", () => {
    assert.equal(updateCategorySchema.safeParse({}).success, false);
    assert.equal(
      createCategorySchema.safeParse({ name: "   " }).success,
      false,
    );
    assert.equal(
      createCategorySchema.safeParse({ name: "Product", extra: true }).success,
      false,
    );
  });
});
