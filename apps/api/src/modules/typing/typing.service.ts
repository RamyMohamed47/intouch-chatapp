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
  scheduleExpirations?: boolean;
  onError?: (error: unknown) => void;
}

const keyFor = ({ conversationId, userId }: TypingIdentity) =>
  `${conversationId}:${userId}`;

const createTypingService = ({
  realtime,
  store = createInMemoryTypingStore(),
  timeoutMs = 5_000,
  scheduler = createInMemoryTypingExpiryScheduler(),
  scheduleExpirations = true,
  onError = () => undefined,
}: TypingServiceDependencies) => {
  const emitStopped = (identity: TypingIdentity) => {
    scheduler.cancel(keyFor(identity));
    realtime.typingUpdated({ ...identity, isTyping: false });
  };

  const scheduleExpiration = (identity: TypingIdentity) => {
    const key = keyFor(identity);
    scheduler.schedule(key, timeoutMs, () => {
      void store
        .clearUser(identity)
        .then((cleared) => {
          if (cleared) emitStopped(identity);
        })
        .catch(onError);
    });
  };

  return {
    async start(conversationId: string, userId: string, socketId: string) {
      const identity = { conversationId, userId };
      await store.markTyping(identity, socketId);
      if (scheduleExpirations) scheduleExpiration(identity);
      realtime.typingUpdated({ ...identity, isTyping: true });
    },

    async stop(conversationId: string, userId: string, socketId: string) {
      const identity = { conversationId, userId };
      if (await store.markStopped(identity, socketId)) emitStopped(identity);
    },

    async disconnect(socketId: string) {
      (await store.removeSocket(socketId)).forEach(emitStopped);
    },

    async clearConversation(conversationId: string) {
      (await store.clearConversation(conversationId)).forEach(emitStopped);
    },

    async clearUserInConversation(conversationId: string, userId: string) {
      const identity = { conversationId, userId };
      if (await store.clearUser(identity)) emitStopped(identity);
    },

    publishExpired(identity: TypingIdentity) {
      emitStopped(identity);
    },
  };
};

export type TypingService = ReturnType<typeof createTypingService>;
export default createTypingService;
