export interface SocketConnectionStore {
  add(userId: string, socketId: string, maximum: number): Promise<boolean>;
  refresh(userId: string, socketId: string): Promise<void>;
  remove(userId: string, socketId: string): Promise<void>;
}

const createInMemorySocketConnectionStore = (): SocketConnectionStore => {
  const socketsByUser = new Map<string, Set<string>>();

  return {
    add(userId, socketId, maximum) {
      const sockets = socketsByUser.get(userId) ?? new Set<string>();
      if (sockets.has(socketId)) return Promise.resolve(true);
      if (sockets.size >= maximum) return Promise.resolve(false);
      sockets.add(socketId);
      socketsByUser.set(userId, sockets);
      return Promise.resolve(true);
    },

    remove(userId, socketId) {
      const sockets = socketsByUser.get(userId);
      if (!sockets) return Promise.resolve();
      sockets.delete(socketId);
      if (sockets.size === 0) socketsByUser.delete(userId);
      return Promise.resolve();
    },

    refresh() {
      return Promise.resolve();
    },
  };
};

export default createInMemorySocketConnectionStore;
