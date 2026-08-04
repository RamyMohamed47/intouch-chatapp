import assert from "node:assert/strict";
import { describe, test } from "node:test";

import { assertTransactionSupport } from "../src/config/database.js";

describe("MongoDB transaction topology", () => {
  test("accepts replica sets and sharded clusters", () => {
    assert.doesNotThrow(() => assertTransactionSupport({ setName: "rs0" }));
    assert.doesNotThrow(() => assertTransactionSupport({ msg: "isdbgrid" }));
  });

  test("rejects standalone MongoDB", () => {
    assert.throws(
      () => assertTransactionSupport({}),
      /replica set or sharded cluster/,
    );
  });
});
