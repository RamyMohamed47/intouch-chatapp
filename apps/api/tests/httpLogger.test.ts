import assert from "node:assert/strict";
import { describe, test } from "node:test";

import { shouldAutoLogHttpRequests } from "../src/middleware/httpLogger.js";

describe("http logger", () => {
  test("disables automatic request completed logs", () => {
    assert.equal(shouldAutoLogHttpRequests, false);
  });
});
