import { describe, expect, it } from "vitest";

import {
  isNearConversationBottom,
  restoredScrollTop,
  shouldSendMessageFromKey,
} from "@/components/conversations/conversation-interactions";

describe("conversation interactions", () => {
  it("sends on Enter but preserves Shift+Enter and IME composition", () => {
    expect(
      shouldSendMessageFromKey({
        key: "Enter",
        shiftKey: false,
        isComposing: false,
      }),
    ).toBe(true);
    expect(
      shouldSendMessageFromKey({
        key: "Enter",
        shiftKey: true,
        isComposing: false,
      }),
    ).toBe(false);
    expect(
      shouldSendMessageFromKey({
        key: "Enter",
        shiftKey: false,
        isComposing: true,
      }),
    ).toBe(false);
  });

  it("distinguishes readers near the bottom from readers viewing history", () => {
    expect(
      isNearConversationBottom({
        clientHeight: 500,
        scrollHeight: 1_000,
        scrollTop: 390,
      }),
    ).toBe(true);
    expect(
      isNearConversationBottom({
        clientHeight: 500,
        scrollHeight: 1_000,
        scrollTop: 200,
      }),
    ).toBe(false);
  });

  it("preserves the visible message after older history is prepended", () => {
    expect(
      restoredScrollTop({
        previousHeight: 1_000,
        previousTop: 240,
        currentHeight: 1_600,
      }),
    ).toBe(840);
  });
});
