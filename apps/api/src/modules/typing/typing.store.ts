export interface TypingIdentity {
  conversationId: string;
  userId: string;
}

export interface TypingStore {
  markTyping(identity: TypingIdentity, socketId: string): boolean;
  markStopped(identity: TypingIdentity, socketId: string): boolean;
  removeSocket(socketId: string): TypingIdentity[];
  clearConversation(conversationId: string): TypingIdentity[];
  clearUser(identity: TypingIdentity): boolean;
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
        return false;
      }
      entries.set(key, { ...identity, socketIds: new Set([socketId]) });
      return true;
    },

    markStopped(identity, socketId) {
      const key = keyFor(identity);
      const entry = entries.get(key);
      if (!entry) return false;
      entry.socketIds.delete(socketId);
      if (entry.socketIds.size > 0) return false;
      entries.delete(key);
      return true;
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
      return stopped;
    },

    clearConversation(conversationId) {
      const stopped: TypingIdentity[] = [];
      for (const [key, entry] of entries) {
        if (entry.conversationId === conversationId) {
          entries.delete(key);
          stopped.push(entry);
        }
      }
      return stopped;
    },

    clearUser(identity) {
      return entries.delete(keyFor(identity));
    },
  };
};

export default createInMemoryTypingStore;
