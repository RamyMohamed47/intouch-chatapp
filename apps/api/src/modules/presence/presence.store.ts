export interface PresenceStore {
  markOnline(userId: string, socketId: string): Promise<boolean>;
  markOffline(userId: string, socketId: string): Promise<boolean>;
  confirmOffline(userId: string): Promise<boolean>;
  isOnline(userId: string): Promise<boolean>;
  refresh(userId: string, socketId: string): Promise<boolean>;
  claimExpired?(limit: number): Promise<string[]>;
}

const createInMemoryPresenceStore = (): PresenceStore => {
  const socketsByUser = new Map<string, Set<string>>();

  return {
    markOnline(userId, socketId) {
      const sockets = socketsByUser.get(userId);
      if (sockets) {
        sockets.add(socketId);
        return Promise.resolve(false);
      }
      socketsByUser.set(userId, new Set([socketId]));
      return Promise.resolve(true);
    },

    markOffline(userId, socketId) {
      const sockets = socketsByUser.get(userId);
      if (!sockets) return Promise.resolve(false);
      sockets.delete(socketId);
      if (sockets.size > 0) return Promise.resolve(false);
      return Promise.resolve(true);
    },

    confirmOffline(userId) {
      const sockets = socketsByUser.get(userId);
      if (!sockets || sockets.size > 0) return Promise.resolve(false);
      socketsByUser.delete(userId);
      return Promise.resolve(true);
    },

    isOnline(userId) {
      return Promise.resolve(socketsByUser.has(userId));
    },

    refresh() {
      return Promise.resolve(false);
    },
  };
};

export default createInMemoryPresenceStore;
