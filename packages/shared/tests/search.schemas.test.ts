import assert from "node:assert/strict";
import { describe, test } from "node:test";

import {
  organizationSearchQuerySchema,
  organizationSearchResponseSchema,
  SearchType,
} from "../search/index.js";

const id = "507f1f77bcf86cd799439011";

describe("shared search contracts", () => {
  test("normalizes strict search queries and pagination", () => {
    assert.deepEqual(organizationSearchQuerySchema.parse({ q: "  launch  " }), {
      q: "launch",
      type: SearchType.ALL,
      limit: 20,
    });
    assert.deepEqual(
      organizationSearchQuerySchema.parse({
        q: "launch",
        type: SearchType.MESSAGES,
        conversationId: id,
        cursor: "cursor",
        limit: "25",
      }),
      {
        q: "launch",
        type: SearchType.MESSAGES,
        conversationId: id,
        cursor: "cursor",
        limit: 25,
      },
    );
  });

  test("rejects short, unknown, and incompatible query fields", () => {
    assert.equal(
      organizationSearchQuerySchema.safeParse({ q: "a" }).success,
      false,
    );
    assert.equal(
      organizationSearchQuerySchema.safeParse({ q: "launch", extra: true })
        .success,
      false,
    );
    assert.equal(
      organizationSearchQuerySchema.safeParse({
        q: "launch",
        type: SearchType.CHANNELS,
        conversationId: id,
      }).success,
      false,
    );
    assert.equal(
      organizationSearchQuerySchema.safeParse({ q: "launch", cursor: "x" })
        .success,
      false,
    );
  });

  test("validates strict discriminated search results", () => {
    const parsed = organizationSearchResponseSchema.parse({
      query: "launch",
      type: SearchType.MESSAGES,
      results: [
        {
          kind: "MESSAGE",
          id,
          conversation: { id, type: "CHANNEL", label: "general" },
          sender: { id, username: "alex", displayName: "Alex Rivera" },
          snippet: [
            { text: "Project ", matched: false },
            { text: "launch", matched: true },
          ],
          createdAt: new Date("2026-01-01T00:00:00.000Z"),
        },
      ],
      nextCursor: null,
    });
    assert.equal(parsed.results[0]?.kind, "MESSAGE");
    assert.equal(
      organizationSearchResponseSchema.safeParse({ ...parsed, unknown: true })
        .success,
      false,
    );
  });
});
