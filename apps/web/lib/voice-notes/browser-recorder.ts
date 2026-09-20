import { fixWebmDuration } from "@fix-webm-duration/fix";

import {
  MAX_VOICE_NOTE_DURATION_MS,
  VOICE_NOTE_WAVEFORM_SAMPLES,
} from "@intouch/shared/uploads";

export interface PreparedBrowserVoiceNote {
  blob: Blob;
  contentType: "audio/mp4" | "audio/webm";
  durationMs: number;
  fileName: "voice-note.m4a" | "voice-note.webm";
  waveform: number[];
}

export interface VoiceNoteRecorder {
  cancel(): void;
  pause(): void;
  resume(): void;
  start(onProgress: (durationMs: number) => void): Promise<void>;
  stop(): Promise<PreparedBrowserVoiceNote>;
}

export const selectSupportedVoiceNoteMimeType = (
  supports: (mimeType: string) => boolean = (mimeType) =>
    MediaRecorder.isTypeSupported(mimeType),
) => {
  if (supports("audio/webm;codecs=opus")) {
    return "audio/webm;codecs=opus" as const;
  }
  if (supports("audio/mp4;codecs=mp4a.40.2")) {
    return "audio/mp4;codecs=mp4a.40.2" as const;
  }
  throw new Error("This browser cannot record supported voice notes");
};

export const startContinuousVoiceNoteRecording = (
  recorder: Pick<MediaRecorder, "start">,
) => {
  // Chromium only writes reliable WebM duration metadata for continuous output.
  recorder.start();
};

export const normalizeWaveform = (
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
    const peak = Math.max(...samples.slice(start, end), 0);
    return Math.max(0, Math.min(100, Math.round(peak)));
  });
};

export class BrowserVoiceNoteRecorder implements VoiceNoteRecorder {
  private audioContext: AudioContext | null = null;
  private chunks: Blob[] = [];
  private mediaRecorder: MediaRecorder | null = null;
  private progressTimer: number | null = null;
  private samples: number[] = [];
  private stream: MediaStream | null = null;
  private startedAt = 0;
  private pausedAt: number | null = null;
  private pausedDuration = 0;

  private elapsed() {
    const end = this.pausedAt ?? performance.now();
    return Math.min(
      MAX_VOICE_NOTE_DURATION_MS,
      Math.max(0, end - this.startedAt - this.pausedDuration),
    );
  }

  async start(onProgress: (durationMs: number) => void) {
    if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) {
      throw new Error(
        "Voice notes require localhost or a secure HTTPS connection",
      );
    }
    if (typeof MediaRecorder === "undefined") {
      throw new Error("Voice-note recording is not supported by this browser");
    }

    const mimeType = selectSupportedVoiceNoteMimeType();
    this.stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        channelCount: 1,
        echoCancellation: true,
        noiseSuppression: true,
      },
    });
    try {
      this.audioContext = new AudioContext();
      const analyser = this.audioContext.createAnalyser();
      analyser.fftSize = 256;
      this.audioContext.createMediaStreamSource(this.stream).connect(analyser);
      const values = new Uint8Array(analyser.fftSize);

      this.mediaRecorder = new MediaRecorder(this.stream, {
        mimeType,
        audioBitsPerSecond: 64_000,
      });
      this.mediaRecorder.addEventListener("dataavailable", (event) => {
        if (event.data.size > 0) this.chunks.push(event.data);
      });
      this.startedAt = performance.now();
      startContinuousVoiceNoteRecording(this.mediaRecorder);
      this.progressTimer = window.setInterval(() => {
        analyser.getByteTimeDomainData(values);
        let squareTotal = 0;
        for (const value of values) {
          const normalized = (value - 128) / 128;
          squareTotal += normalized * normalized;
        }
        this.samples.push(
          Math.min(100, Math.sqrt(squareTotal / values.length) * 240),
        );
        onProgress(Math.round(this.elapsed()));
      }, 100);
    } catch (error) {
      this.dispose();
      throw error;
    }
  }

  pause() {
    if (this.mediaRecorder?.state !== "recording") return;
    this.mediaRecorder.pause();
    this.pausedAt = performance.now();
  }

  resume() {
    if (this.mediaRecorder?.state !== "paused" || this.pausedAt === null)
      return;
    this.pausedDuration += performance.now() - this.pausedAt;
    this.pausedAt = null;
    this.mediaRecorder.resume();
  }

  async stop() {
    const recorder = this.mediaRecorder;
    if (!recorder || recorder.state === "inactive") {
      throw new Error("No voice note is being recorded");
    }
    const durationMs = Math.round(this.elapsed());
    if (this.progressTimer !== null) window.clearInterval(this.progressTimer);
    this.progressTimer = null;
    await new Promise<void>((resolve) => {
      recorder.addEventListener("stop", () => resolve(), { once: true });
      recorder.stop();
    });
    const isWebm = recorder.mimeType.startsWith("audio/webm");
    const contentType = isWebm ? "audio/webm" : "audio/mp4";
    let blob = new Blob(this.chunks, { type: contentType });
    if (isWebm) blob = await fixWebmDuration(blob, durationMs);
    const result: PreparedBrowserVoiceNote = {
      blob,
      contentType,
      durationMs,
      fileName: isWebm ? "voice-note.webm" : "voice-note.m4a",
      waveform: normalizeWaveform(this.samples),
    };
    this.dispose();
    return result;
  }

  cancel() {
    if (this.mediaRecorder && this.mediaRecorder.state !== "inactive") {
      this.mediaRecorder.stop();
    }
    this.dispose();
  }

  private dispose() {
    if (this.progressTimer !== null) window.clearInterval(this.progressTimer);
    this.progressTimer = null;
    for (const track of this.stream?.getTracks() ?? []) track.stop();
    this.stream = null;
    void this.audioContext?.close().catch(() => undefined);
    this.audioContext = null;
    this.mediaRecorder = null;
  }
}
