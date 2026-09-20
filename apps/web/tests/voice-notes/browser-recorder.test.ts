import { describe, expect, it, vi } from "vitest";

import {
  normalizeWaveform,
  selectSupportedVoiceNoteMimeType,
  startContinuousVoiceNoteRecording,
} from "@/lib/voice-notes/browser-recorder";

describe("browser voice-note waveform", () => {
  it("downsamples arbitrary metering into 64 bounded peaks", () => {
    const waveform = normalizeWaveform([0, 20, 110, -4, 70]);
    expect(waveform).toHaveLength(64);
    expect(Math.min(...waveform)).toBeGreaterThanOrEqual(0);
    expect(Math.max(...waveform)).toBeLessThanOrEqual(100);
  });

  it("uses a visible baseline when no samples were captured", () => {
    expect(normalizeWaveform([])).toEqual(Array(64).fill(4));
  });

  it("prefers Opus while retaining AAC as the Safari fallback", () => {
    expect(selectSupportedVoiceNoteMimeType(() => true)).toBe(
      "audio/webm;codecs=opus",
    );
    expect(
      selectSupportedVoiceNoteMimeType(
        (mimeType) => mimeType === "audio/mp4;codecs=mp4a.40.2",
      ),
    ).toBe("audio/mp4;codecs=mp4a.40.2");
    expect(
      selectSupportedVoiceNoteMimeType(
        (mimeType) => mimeType === "audio/webm;codecs=opus",
      ),
    ).toBe("audio/webm;codecs=opus");
    expect(() =>
      selectSupportedVoiceNoteMimeType(
        (mimeType) => mimeType === "audio/mp4" || mimeType === "audio/webm",
      ),
    ).toThrow("cannot record supported voice notes");
  });

  it("records one continuous blob so Chromium writes valid duration metadata", () => {
    const start = vi.fn();

    startContinuousVoiceNoteRecording({ start });

    expect(start).toHaveBeenCalledOnce();
    expect(start).toHaveBeenCalledWith();
  });
});
