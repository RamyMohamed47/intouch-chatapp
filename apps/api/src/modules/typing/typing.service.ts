import type { TypingRealtime } from "./typing.realtime.js";
import createInMemoryTypingExpiryScheduler, {
  type TypingExpiryScheduler,
} from "./typing.scheduler.js";
import createInMemoryTypingStore, {
  type TypingIdentity,
  type TypingStore,
} from "./typing.store.js";

export interface TypingServiceDependencies {
  realtime: TypingRealtime;
  store?: TypingStore;
  timeoutMs?: number;
  scheduler?: TypingExpiryScheduler;
}

const keyFor = ({ conversationId, userId }: TypingIdentity) =>
  `${conversationId}:${userId}`;

const createTypingService = ({
  realtime,
  store = createInMemoryTypingStore(),
  timeoutMs = 5_000,
  scheduler = createInMemoryTypingExpiryScheduler(),
}: TypingServiceDependencies) => {
  const emitStopped = (identity: TypingIdentity) => {
    scheduler.cancel(keyFor(identity));
    realtime.typingUpdated({ ...identity, isTyping: false });
  };

  const scheduleExpiration = (identity: TypingIdentity) => {
    const key = keyFor(identity);
    scheduler.schedule(key, timeoutMs, () => {
      if (store.clearUser(identity)) emitStopped(identity);
    });
  };

  return {
    start(conversationId: string, userId: string, socketId: string) {
      const identity = { conversationId, userId };
      const becameActive = store.markTyping(identity, socketId);
      scheduleExpiration(identity);
      if (becameActive) {
        realtime.typingUpdated({ ...identity, isTyping: true });
      }
    },

    stop(conversationId: string, userId: string, socketId: string) {
      const identity = { conversationId, userId };
      if (store.markStopped(identity, socketId)) emitStopped(identity);
    },

    disconnect(socketId: string) {
      store.removeSocket(socketId).forEach(emitStopped);
    },

    clearConversation(conversationId: string) {
      store.clearConversation(conversationId).forEach(emitStopped);
    },

    clearUserInConversation(conversationId: string, userId: string) {
      const identity = { conversationId, userId };
      if (store.clearUser(identity)) emitStopped(identity);
    },
  };
};

export type TypingService = ReturnType<typeof createTypingService>;
export default createTypingService;
