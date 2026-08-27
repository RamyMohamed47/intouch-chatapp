import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { useTypingState } from "@/lib/realtime/use-typing-state";

const conversationId = "64d000000000000000000001";
const secondConversationId = "64d000000000000000000002";
const currentUserId = "64b000000000000000000001";
const peerUserId = "64b000000000000000000002";

describe("useTypingState", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("deduplicates heartbeats while renewing the fallback expiry", () => {
    vi.useFakeTimers();
    let renderCount = 0;
    const { result } = renderHook(() => {
      renderCount += 1;
      return useTypingState(currentUserId, 7_000);
    });

    act(() => {
      result.current.applyTypingUpdate({
        conversationId,
        userId: peerUserId,
        isTyping: true,
      });
    });
    expect(result.current.typingUserIds(conversationId)).toEqual([peerUserId]);
    const renderCountAfterFirstHeartbeat = renderCount;

    act(() => {
      vi.advanceTimersByTime(4_000);
    });
    act(() => {
      result.current.applyTypingUpdate({
        conversationId,
        userId: peerUserId,
        isTyping: true,
      });
    });
    expect(renderCount).toBe(renderCountAfterFirstHeartbeat);

    act(() => {
      vi.advanceTimersByTime(4_000);
    });
    expect(result.current.typingUserIds(conversationId)).toEqual([peerUserId]);
    act(() => {
      vi.advanceTimersByTime(3_001);
    });
    expect(result.current.typingUserIds(conversationId)).toEqual([]);
  });

  it("removes false updates, excludes self events, and clears conversations", () => {
    vi.useFakeTimers();
    const { result } = renderHook(() => useTypingState(currentUserId));

    act(() => {
      result.current.applyTypingUpdate({
        conversationId,
        userId: currentUserId,
        isTyping: true,
      });
      result.current.applyTypingUpdate({
        conversationId,
        userId: peerUserId,
        isTyping: true,
      });
      result.current.applyTypingUpdate({
        conversationId: secondConversationId,
        userId: peerUserId,
        isTyping: true,
      });
    });
    expect(result.current.typingUserIds(conversationId)).toEqual([peerUserId]);

    act(() => result.current.clearTypingConversation(conversationId));
    expect(result.current.typingUserIds(conversationId)).toEqual([]);
    expect(result.current.typingUserIds(secondConversationId)).toEqual([
      peerUserId,
    ]);

    act(() => {
      result.current.applyTypingUpdate({
        conversationId: secondConversationId,
        userId: peerUserId,
        isTyping: false,
      });
    });
    expect(result.current.typingUserIds(secondConversationId)).toEqual([]);
  });

  it("disposes every fallback timer when unmounted", () => {
    vi.useFakeTimers();
    const { result, unmount } = renderHook(() => useTypingState(currentUserId));
    act(() => {
      result.current.applyTypingUpdate({
        conversationId,
        userId: peerUserId,
        isTyping: true,
      });
      result.current.applyTypingUpdate({
        conversationId: secondConversationId,
        userId: peerUserId,
        isTyping: true,
      });
    });
    expect(vi.getTimerCount()).toBe(2);
    unmount();
    expect(vi.getTimerCount()).toBe(0);
  });
});
