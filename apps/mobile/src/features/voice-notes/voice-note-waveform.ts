import { VOICE_NOTE_WAVEFORM_SAMPLES } from "@intouch/shared/uploads";

export const normalizeVoiceNoteWaveform = (
  samples: readonly number[],
  targetLength = VOICE_NOTE_WAVEFORM_SAMPLES,
) => {
  if (samples.length === 0) return Array<number>(targetLength).fill(4);
  return Array.from({ length: targetLength }, (_, index) => {
    const start = Math.floor((index * samples.length) / targetLength);
    const end = Math.max(
      start + 1,
      Math.floor(((index + 1) * samples.length) / targetLength),
    );
    return Math.max(
      0,
      Math.min(100, Math.round(Math.max(...samples.slice(start, end), 0))),
    );
  });
};

export const meteringToPeak = (metering?: number) => {
  if (metering === undefined || !Number.isFinite(metering)) return 4;
  return Math.max(0, Math.min(100, Math.round(((metering + 60) / 60) * 100)));
};
