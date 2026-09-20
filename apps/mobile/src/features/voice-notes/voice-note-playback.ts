interface AudioLoadStatus {
  error: string | null;
  isLoaded: boolean;
}

interface ReplaceableAudioPlayer {
  addListener: (
    event: "playbackStatusUpdate",
    listener: (status: AudioLoadStatus) => void,
  ) => { remove: () => void };
  replace: (source: { uri: string }) => void;
}

const URL_PATTERN = /https?:\/\/[^\s)]+/gi;
const UUID_PATTERN =
  /\b[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\b/gi;
const OBJECT_ID_PATTERN = /\b[0-9a-f]{24}\b/gi;

export const sanitizeVoiceNotePlaybackError = (error: unknown) => {
  const message =
    error instanceof Error
      ? `${error.name}: ${error.message}`
      : typeof error === "string"
        ? error
        : "Unknown playback failure";
  return message
    .replace(URL_PATTERN, "[url]")
    .replace(UUID_PATTERN, "[id]")
    .replace(OBJECT_ID_PATTERN, "[id]")
    .slice(0, 300);
};

export const replaceAudioSourceAndWait = (
  player: ReplaceableAudioPlayer,
  uri: string,
  timeoutMs = 15_000,
) =>
  new Promise<void>((resolve, reject) => {
    const cleanup: { subscription?: { remove: () => void } } = {};
    let settled = false;
    const timeout = setTimeout(() => {
      finish(new Error("Audio source loading timed out"));
    }, timeoutMs);
    const finish = (error?: Error) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      cleanup.subscription?.remove();
      if (error) reject(error);
      else resolve();
    };

    cleanup.subscription = player.addListener(
      "playbackStatusUpdate",
      (status) => {
        if (status.error) {
          finish(new Error(status.error));
        } else if (status.isLoaded) {
          finish();
        }
      },
    );

    try {
      player.replace({ uri });
    } catch (error) {
      finish(
        error instanceof Error
          ? error
          : new Error("Audio source replacement failed"),
      );
    }
  });
