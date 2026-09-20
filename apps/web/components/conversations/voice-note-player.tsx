"use client";

import { Pause, Play } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import type { VoiceNoteDto } from "@intouch/shared/messages";

import { Button } from "@/components/ui/button";
import { uploadsApi } from "@/lib/api/uploads";
import { useVoice } from "@/lib/voice/provider";

let stopActivePlayer: (() => void) | null = null;

const formatDuration = (seconds: number) =>
  `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, "0")}`;

export function VoiceNotePlayer({ voiceNote }: { voiceNote: VoiceNoteDto }) {
  const voice = useVoice();
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const refreshedRef = useRef(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [rate, setRate] = useState<1 | 1.5 | 2>(1);
  const [error, setError] = useState<string | null>(null);

  const reset = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.pause();
    audio.currentTime = 0;
    setCurrentTime(0);
    setPlaying(false);
  }, []);

  const load = async (refresh = false) => {
    if (audioRef.current && !refresh) return audioRef.current;
    const { accessUrl } = await uploadsApi.access(voiceNote.assetId);
    const existing = audioRef.current;
    const audio = existing ?? new Audio();
    audio.preload = "metadata";
    audio.src = accessUrl;
    audio.playbackRate = rate;
    if (!existing) {
      audio.addEventListener("timeupdate", () =>
        setCurrentTime(audio.currentTime),
      );
      audio.addEventListener("play", () => setPlaying(true));
      audio.addEventListener("pause", () => setPlaying(false));
      audio.addEventListener("ended", reset);
    }
    audioRef.current = audio;
    return audio;
  };

  const toggle = async () => {
    setError(null);
    try {
      const audio = await load();
      if (!audio.paused) {
        audio.pause();
        return;
      }
      if (stopActivePlayer !== reset) stopActivePlayer?.();
      stopActivePlayer = reset;
      await audio.play();
    } catch {
      if (!refreshedRef.current) {
        refreshedRef.current = true;
        try {
          const audio = await load(true);
          if (stopActivePlayer !== reset) stopActivePlayer?.();
          stopActivePlayer = reset;
          await audio.play();
          return;
        } catch {
          // The user-facing failure below covers both access and playback errors.
        }
      }
      setError("Voice note could not be played");
    }
  };

  useEffect(() => {
    if (voice.activeSession) reset();
  }, [reset, voice.activeSession]);

  useEffect(() => {
    const pauseWhenHidden = () => {
      if (document.visibilityState === "hidden") audioRef.current?.pause();
    };
    document.addEventListener("visibilitychange", pauseWhenHidden);
    return () => {
      document.removeEventListener("visibilitychange", pauseWhenHidden);
      if (stopActivePlayer === reset) stopActivePlayer = null;
      audioRef.current?.pause();
      audioRef.current?.removeAttribute("src");
    };
  }, [reset]);

  const duration = voiceNote.durationMs / 1_000;
  return (
    <div className="mt-3 min-w-64 rounded-xl border border-primary/15 bg-primary/5 p-3">
      <div className="flex items-center gap-2">
        <Button
          aria-label={playing ? "Pause voice note" : "Play voice note"}
          onClick={() => void toggle()}
          size="icon-sm"
          type="button"
          variant="secondary"
        >
          {playing ? <Pause aria-hidden /> : <Play aria-hidden />}
        </Button>
        <div
          className="relative flex h-10 flex-1 items-center gap-px"
          aria-hidden
        >
          {voiceNote.waveform.map((peak, index) => (
            <span
              className={
                index / voiceNote.waveform.length <= currentTime / duration
                  ? "bg-primary"
                  : "bg-muted-foreground/35"
              }
              key={index}
              style={{ height: `${Math.max(8, peak)}%`, flex: 1 }}
            />
          ))}
          <input
            aria-label="Seek voice note"
            className="absolute inset-0 size-full cursor-pointer opacity-0"
            max={duration}
            min={0}
            onChange={(event) => {
              const next = Number(event.currentTarget.value);
              setCurrentTime(next);
              if (audioRef.current) audioRef.current.currentTime = next;
            }}
            step={0.1}
            type="range"
            value={Math.min(currentTime, duration)}
          />
        </div>
        <span className="min-w-16 font-mono text-xs text-muted-foreground">
          {formatDuration(currentTime)} / {formatDuration(duration)}
        </span>
        <Button
          aria-label={`Playback speed ${rate} times`}
          onClick={() => {
            const next = rate === 1 ? 1.5 : rate === 1.5 ? 2 : 1;
            setRate(next);
            if (audioRef.current) audioRef.current.playbackRate = next;
          }}
          size="sm"
          type="button"
          variant="ghost"
        >
          {rate}x
        </Button>
      </div>
      {error ? <p className="mt-2 text-xs text-destructive">{error}</p> : null}
    </div>
  );
}
