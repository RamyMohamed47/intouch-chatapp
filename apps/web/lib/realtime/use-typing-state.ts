"use client";

import type { TypingEvent } from "@intouch/shared/realtime";
import { useCallback, useEffect, useRef, useState } from "react";

export const TYPING_FALLBACK_TIMEOUT_MS = 7_000;

interface TypingFallback {
  conversationId: string;
  timer: ReturnType<typeof setTimeout>;
}

const EMPTY_TYPING_USERS: string[] = [];
const keyFor = ({
  conversationId,
  userId,
}: Pick<TypingEvent, "conversationId" | "userId">) =>
  `${conversationId}:${userId}`;

export function useTypingState(
  currentUserId?: string,
  fallbackTimeoutMs = TYPING_FALLBACK_TIMEOUT_MS,
) {
  const [typingByConversation, setTypingByConversation] = useState<
    Record<string, string[]>
  >({});
  const fallbacks = useRef(new Map<string, TypingFallback>());
  const activeTyping = useRef(new Set<string>());

  const cancelFallback = useCallback((key: string) => {
    const fallback = fallbacks.current.get(key);
    if (fallback) clearTimeout(fallback.timer);
    fallbacks.current.delete(key);
  }, []);

  const removeTypingUser = useCallback(
    (conversationId: string, userId: string) => {
      if (!activeTyping.current.delete(keyFor({ conversationId, userId }))) {
        return;
      }
      setTypingByConversation((current) => {
        const users = current[conversationId];
        if (!users) return current;

        const remainingUsers = users.filter((id) => id !== userId);
        const next = { ...current };
        if (remainingUsers.length === 0) delete next[conversationId];
        else next[conversationId] = remainingUsers;
        return next;
      });
    },
    [],
  );

  const applyTypingUpdate = useCallback(
    (update: TypingEvent) => {
      const key = keyFor(update);
      cancelFallback(key);

      if (!update.isTyping || update.userId === currentUserId) {
        removeTypingUser(update.conversationId, update.userId);
        return;
      }

      const timer = setTimeout(() => {
        fallbacks.current.delete(key);
        removeTypingUser(update.conversationId, update.userId);
      }, fallbackTimeoutMs);
      fallbacks.current.set(key, {
        conversationId: update.conversationId,
        timer,
      });

      if (activeTyping.current.has(key)) return;
      activeTyping.current.add(key);
      setTypingByConversation((current) => {
        const users = current[update.conversationId] ?? EMPTY_TYPING_USERS;
        return {
          ...current,
          [update.conversationId]: [...users, update.userId],
        };
      });
    },
    [cancelFallback, currentUserId, fallbackTimeoutMs, removeTypingUser],
  );

  const clearTypingConversation = useCallback((conversationId: string) => {
    for (const [key, fallback] of fallbacks.current) {
      if (fallback.conversationId === conversationId) {
        clearTimeout(fallback.timer);
        fallbacks.current.delete(key);
        activeTyping.current.delete(key);
      }
    }
    setTypingByConversation((current) => {
      if (!(conversationId in current)) return current;
      const next = { ...current };
      delete next[conversationId];
      return next;
    });
  }, []);

  const clearAllTyping = useCallback(() => {
    for (const { timer } of fallbacks.current.values()) clearTimeout(timer);
    fallbacks.current.clear();
    activeTyping.current.clear();
    setTypingByConversation((current) =>
      Object.keys(current).length === 0 ? current : {},
    );
  }, []);

  useEffect(
    () => () => {
      for (const { timer } of fallbacks.current.values()) clearTimeout(timer);
      fallbacks.current.clear();
      activeTyping.current.clear();
    },
    [],
  );

  const typingUserIds = useCallback(
    (conversationId: string) =>
      typingByConversation[conversationId] ?? EMPTY_TYPING_USERS,
    [typingByConversation],
  );

  return {
    applyTypingUpdate,
    clearAllTyping,
    clearTypingConversation,
    typingUserIds,
  };
}
