export interface TypingExpiryScheduler {
  cancel(key: string): void;
  schedule(key: string, delayMs: number, expire: () => void): void;
}

const createInMemoryTypingExpiryScheduler = (): TypingExpiryScheduler => {
  const timers = new Map<string, NodeJS.Timeout>();
  const cancel = (key: string) => {
    const timer = timers.get(key);
    if (timer) clearTimeout(timer);
    timers.delete(key);
  };

  return {
    cancel,
    schedule(key, delayMs, expire) {
      cancel(key);
      const timer = setTimeout(() => {
        timers.delete(key);
        expire();
      }, delayMs);
      timer.unref();
      timers.set(key, timer);
    },
  };
};

export default createInMemoryTypingExpiryScheduler;
