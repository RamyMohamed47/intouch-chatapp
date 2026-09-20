import {
  meteringToPeak,
  normalizeVoiceNoteWaveform,
} from "@/features/voice-notes/voice-note-waveform";

describe("voice-note waveform", () => {
  it("always creates exactly 64 bounded peaks", () => {
    const waveform = normalizeVoiceNoteWaveform([0, 15, 120, -4, 52]);
    expect(waveform).toHaveLength(64);
    expect(Math.min(...waveform)).toBeGreaterThanOrEqual(0);
    expect(Math.max(...waveform)).toBeLessThanOrEqual(100);
  });

  it("maps recorder metering into presentation peaks", () => {
    expect(meteringToPeak(-60)).toBe(0);
    expect(meteringToPeak(-30)).toBe(50);
    expect(meteringToPeak(0)).toBe(100);
    expect(meteringToPeak(undefined)).toBe(4);
  });
});
