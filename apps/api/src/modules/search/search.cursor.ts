import { createHash } from "node:crypto";

import { SearchCursorError } from "./search.errors.js";
import type { SearchKind, SearchProvider } from "./search.types.js";

type NativeCursor = {
  v: 1;
  provider: "native";
  kind: SearchKind;
  fingerprint: string;
  score: number;
  id: string;
};

type AtlasCursor = {
  v: 1;
  provider: "atlas";
  kind: SearchKind;
  fingerprint: string;
  token: string;
};

export type SearchCursor = NativeCursor | AtlasCursor;

export const createSearchFingerprint = (input: {
  provider: SearchProvider;
  kind: SearchKind;
  query: string;
  conversationId?: string;
}) => createHash("sha256").update(JSON.stringify(input)).digest("base64url");

export const encodeSearchCursor = (cursor: SearchCursor) =>
  Buffer.from(JSON.stringify(cursor)).toString("base64url");

export const decodeSearchCursor = (
  value: string | undefined,
  expected: {
    provider: SearchProvider;
    kind: SearchKind;
    fingerprint: string;
  },
): SearchCursor | undefined => {
  if (!value) return undefined;
  try {
    const parsed = JSON.parse(
      Buffer.from(value, "base64url").toString("utf8"),
    ) as Record<string, unknown>;
    if (
      parsed.v !== 1 ||
      parsed.provider !== expected.provider ||
      parsed.kind !== expected.kind ||
      parsed.fingerprint !== expected.fingerprint
    ) {
      throw new SearchCursorError();
    }
    if (
      parsed.provider === "native" &&
      typeof parsed.score === "number" &&
      Number.isFinite(parsed.score) &&
      typeof parsed.id === "string"
    ) {
      return parsed as NativeCursor;
    }
    if (parsed.provider === "atlas" && typeof parsed.token === "string") {
      return parsed as AtlasCursor;
    }
  } catch (error) {
    if (error instanceof SearchCursorError) throw error;
    throw new SearchCursorError();
  }
  throw new SearchCursorError();
};
