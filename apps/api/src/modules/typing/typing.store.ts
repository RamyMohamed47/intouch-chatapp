export interface TypingIdentity {
  conversationId: string;
  userId: string;
}

export interface TypingStore {
  markTyping(identity: TypingIdentity, socketId: string): Promise<boolean>;
  markStopped(identity: TypingIdentity, socketId: string): Promise<boolean>;
  removeSocket(socketId: string): Promise<TypingIdentity[]>;
  clearConversation(conversationId: string): Promise<TypingIdentity[]>;
  clearUser(identity: TypingIdentity): Promise<boolean>;
  claimExpired?(limit: number): Promise<TypingIdentity[]>;
}

interface TypingEntry extends TypingIdentity {
  socketIds: Set<string>;
}

const keyFor = ({ conversationId, userId }: TypingIdentity) =>
  `${conversationId}:${userId}`;

const createInMemoryTypingStore = (): TypingStore => {
  const entries = new Map<string, TypingEntry>();

  return {
    markTyping(identity, socketId) {
      const key = keyFor(identity);
      const entry = entries.get(key);
      if (entry) {
        entry.socketIds.add(socketId);
        return Promise.resolve(false);
      }
      entries.set(key, { ...identity, socketIds: new Set([socketId]) });
      return Promise.resolve(true);
    },

    markStopped(identity, socketId) {
      const key = keyFor(identity);
      const entry = entries.get(key);
      if (!entry) return Promise.resolve(false);
      entry.socketIds.delete(socketId);
      if (entry.socketIds.size > 0) return Promise.resolve(false);
      entries.delete(key);
      return Promise.resolve(true);
    },

    removeSocket(socketId) {
      const stopped: TypingIdentity[] = [];
      for (const [key, entry] of entries) {
        entry.socketIds.delete(socketId);
        if (entry.socketIds.size === 0) {
          entries.delete(key);
          stopped.push(entry);
        }
      }
      return Promise.resolve(stopped);
    },

    clearConversation(conversationId) {
      const stopped: TypingIdentity[] = [];
      for (const [key, entry] of entries) {
        if (entry.conversationId === conversationId) {
          entries.delete(key);
          stopped.push(entry);
        }
      }
      return Promise.resolve(stopped);
    },

    clearUser(identity) {
      return Promise.resolve(entries.delete(keyFor(identity)));
    },
  };
};

export default createInMemoryTypingStore;
