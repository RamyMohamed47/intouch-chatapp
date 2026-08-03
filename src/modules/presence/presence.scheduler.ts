export interface PresenceTransitionScheduler {
  cancel(userId: string): void;
  schedule(userId: string, delayMs: number, transition: () => void): void;
}

const createInMemoryPresenceTransitionScheduler =
  (): PresenceTransitionScheduler => {
    const timers = new Map<string, NodeJS.Timeout>();
    const cancel = (userId: string) => {
      const timer = timers.get(userId);
      if (timer) clearTimeout(timer);
      timers.delete(userId);
    };

    return {
      cancel,

      schedule(userId, delayMs, transition) {
        cancel(userId);
        const timer = setTimeout(() => {
          timers.delete(userId);
          transition();
        }, delayMs);
        timer.unref();
        timers.set(userId, timer);
      },
    };
  };

export default createInMemoryPresenceTransitionScheduler;
