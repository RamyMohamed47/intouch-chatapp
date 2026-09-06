export const CallToneKind = {
  Incoming: "INCOMING",
  Ringback: "RINGBACK",
} as const;

export type CallToneKindValue =
  (typeof CallToneKind)[keyof typeof CallToneKind];
export type CallTonePlaybackState = "IDLE" | "PLAYING" | "BLOCKED" | "FAILED";

type CallToneAudio = Pick<
  HTMLAudioElement,
  | "currentTime"
  | "load"
  | "loop"
  | "pause"
  | "play"
  | "preload"
  | "removeAttribute"
  | "src"
  | "volume"
>;

export type CallToneAudioFactory = (source: string) => CallToneAudio;

export interface CallTonePlayer {
  dispose(): void;
  play(tone: CallToneKindValue): Promise<CallTonePlaybackState>;
  stop(): void;
}

const configurations: Record<
  CallToneKindValue,
  { source: string; volume: number }
> = {
  INCOMING: {
    source: "/audio/calls/intouch-incoming.wav",
    volume: 0.55,
  },
  RINGBACK: {
    source: "/audio/calls/intouch-ringback.wav",
    volume: 0.22,
  },
};

const safelyStop = (audio: CallToneAudio) => {
  audio.pause();
  try {
    audio.currentTime = 0;
  } catch {
    // An unloaded element may reject seeking; pausing is still sufficient.
  }
};

const isAutoplayRejection = (error: unknown) =>
  error instanceof Error && error.name === "NotAllowedError";

export const createCallTonePlayer = (
  audioFactory: CallToneAudioFactory = (source) => new Audio(source),
): CallTonePlayer => {
  const audioByTone = Object.fromEntries(
    Object.entries(configurations).map(([tone, configuration]) => {
      const audio = audioFactory(configuration.source);
      audio.src = configuration.source;
      audio.loop = true;
      audio.preload = "auto";
      audio.volume = configuration.volume;
      return [tone, audio];
    }),
  ) as Record<CallToneKindValue, CallToneAudio>;
  let currentTone: CallToneKindValue | null = null;
  let currentState: CallTonePlaybackState = "IDLE";
  let requestVersion = 0;
  let disposed = false;

  const stop = () => {
    requestVersion += 1;
    Object.values(audioByTone).forEach(safelyStop);
    currentTone = null;
    currentState = "IDLE";
  };

  return {
    async play(tone) {
      if (disposed) return "FAILED";
      if (currentTone === tone && currentState === "PLAYING") {
        return currentState;
      }
      if (currentTone !== tone) stop();
      currentTone = tone;
      const version = ++requestVersion;
      try {
        await audioByTone[tone].play();
        if (disposed || currentTone !== tone || version !== requestVersion) {
          safelyStop(audioByTone[tone]);
          return "IDLE";
        }
        currentState = "PLAYING";
      } catch (error) {
        if (currentTone !== tone || version !== requestVersion) return "IDLE";
        currentState = isAutoplayRejection(error) ? "BLOCKED" : "FAILED";
      }
      return currentState;
    },
    stop,
    dispose() {
      if (disposed) return;
      stop();
      disposed = true;
      Object.values(audioByTone).forEach((audio) => {
        audio.removeAttribute("src");
        audio.load();
      });
    },
  };
};
