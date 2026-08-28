import assert from "node:assert/strict";
import { describe, test } from "node:test";

import {
  createSearchFingerprint,
  decodeSearchCursor,
  encodeSearchCursor,
} from "../src/modules/search/search.cursor.js";
import { SearchCursorError } from "../src/modules/search/search.errors.js";

describe("search cursors", () => {
  test("round-trips native cursors bound to the exact search", () => {
    const fingerprint = createSearchFingerprint({
      provider: "native",
      kind: "MESSAGES",
      query: "roadmap",
      conversationId: "507f1f77bcf86cd799439001",
    });
    const encoded = encodeSearchCursor({
      v: 1,
      provider: "native",
      kind: "MESSAGES",
      fingerprint,
      score: 3.5,
      id: "507f1f77bcf86cd799439002",
    });
    assert.deepEqual(
      decodeSearchCursor(encoded, {
        provider: "native",
        kind: "MESSAGES",
        fingerprint,
      }),
      {
        v: 1,
        provider: "native",
        kind: "MESSAGES",
        fingerprint,
        score: 3.5,
        id: "507f1f77bcf86cd799439002",
      },
    );
  });

  test("rejects cursors reused for another query or provider", () => {
    const fingerprint = createSearchFingerprint({
      provider: "atlas",
      kind: "PEOPLE",
      query: "alex",
    });
    const encoded = encodeSearchCursor({
      v: 1,
      provider: "atlas",
      kind: "PEOPLE",
      fingerprint,
      token: "opaque-atlas-token",
    });
    assert.throws(
      () =>
        decodeSearchCursor(encoded, {
          provider: "atlas",
          kind: "PEOPLE",
          fingerprint: createSearchFingerprint({
            provider: "atlas",
            kind: "PEOPLE",
            query: "lina",
          }),
        }),
      SearchCursorError,
    );
  });
});
