"use client";

import { Mic, Pause, Play, RefreshCw, Send, Trash2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type { MessageDto } from "@intouch/shared/messages";
import {
  MAX_VOICE_NOTE_DURATION_MS,
  MIN_VOICE_NOTE_DURATION_MS,
  UploadPurpose,
} from "@intouch/shared/uploads";

import { Button } from "@/components/ui/button";
import { ApiError } from "@/lib/api/client";
import { messagesApi } from "@/lib/api/messages";
import { uploadsApi } from "@/lib/api/uploads";
import { putPresignedUpload } from "@/lib/uploads/direct-upload";
import {
  BrowserVoiceNoteRecorder,
  type PreparedBrowserVoiceNote,
} from "@/lib/voice-notes/browser-recorder";

const formatDuration = (durationMs: number) =>
  `${Math.floor(durationMs / 60_000)}:${String(Math.floor((durationMs % 60_000) / 1_000)).padStart(2, "0")}`;

export function VoiceNoteRecorder({
  conversationId,
  disabled,
  onBusyChange,
  onError,
  onSent,
  replyToMessageId,
  visible,
}: {
  conversationId: string;
  disabled: boolean;
  onBusyChange: (busy: boolean) => void;
  onError: (message: string | null) => void;
  onSent: (message: MessageDto) => void;
  replyToMessageId?: string;
  visible: boolean;
}) {
  const recorderRef = useRef<BrowserVoiceNoteRecorder | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const sendingRef = useRef(false);
  const stoppingRef = useRef(false);
  const [durationMs, setDurationMs] = useState(0);
  const [paused, setPaused] = useState(false);
  const [prepared, setPrepared] = useState<PreparedBrowserVoiceNote | null>(
    null,
  );
  const [promotedUploadId, setPromotedUploadId] = useState<string | null>(null);
  const [recording, setRecording] = useState(false);
  const [preparing, setPreparing] = useState(false);
  const [sending, setSending] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    onBusyChange(
      recording ||
        preparing ||
        sending ||
        prepared !== null ||
        promotedUploadId !== null,
    );
  }, [onBusyChange, prepared, preparing, promotedUploadId, recording, sending]);

  const discard = async () => {
    recorderRef.current?.cancel();
    recorderRef.current = null;
    abortRef.current?.abort();
    abortRef.current = null;
    stoppingRef.current = false;
    if (promotedUploadId) {
      await uploadsApi.cancel(promotedUploadId).catch(() => undefined);
    }
    setDurationMs(0);
    setPaused(false);
    setPrepared(null);
    setPromotedUploadId(null);
    setRecording(false);
    setPreparing(false);
    setSending(false);
    setFailed(false);
  };

  const createMessage = async (uploadId: string) => {
    const message = await messagesApi.create(conversationId, {
      voiceNoteUploadId: uploadId,
      ...(replyToMessageId ? { replyToMessageId } : {}),
    });
    setPromotedUploadId(null);
    setPrepared(null);
    setDurationMs(0);
    setFailed(false);
    onSent(message);
  };

  const sendPrepared = async (nextPrepared?: PreparedBrowserVoiceNote) => {
    const voiceNote = nextPrepared ?? prepared;
    if (!voiceNote || sendingRef.current) return;
    if (voiceNote.durationMs < MIN_VOICE_NOTE_DURATION_MS) {
      onError("A voice note must be at least one second long");
      await discard();
      return;
    }
    sendingRef.current = true;
    setSending(true);
    setFailed(false);
    onError(null);
    try {
      if (promotedUploadId) {
        await createMessage(promotedUploadId);
        return;
      }
      const controller = new AbortController();
      abortRef.current = controller;
      const response = await uploadsApi.create({
        purpose: UploadPurpose.VOICE_NOTE,
        conversationId,
        files: [
          {
            fileName: voiceNote.fileName,
            contentType: voiceNote.contentType,
            size: voiceNote.blob.size,
            durationMs: voiceNote.durationMs,
            waveform: voiceNote.waveform,
          },
        ],
      });
      const ticket = response.uploadTickets[0];
      if (!ticket) throw new Error("Voice-note upload ticket was not issued");
      await putPresignedUpload({
        file: voiceNote.blob,
        uploadUrl: ticket.uploadUrl,
        headers: ticket.headers,
        signal: controller.signal,
      });
      const completed = await uploadsApi.complete(ticket.uploadId);
      setPromotedUploadId(completed.uploadId);
      await createMessage(completed.uploadId);
    } catch (error) {
      if (
        error instanceof ApiError &&
        error.status === 400 &&
        error.code === "VALIDATION_ERROR"
      ) {
        setDurationMs(0);
        setPrepared(null);
        setPromotedUploadId(null);
        setFailed(false);
        onError("The recording could not be verified. Please record it again.");
        return;
      }
      setFailed(true);
      onError(
        error instanceof Error ? error.message : "Voice note could not be sent",
      );
    } finally {
      abortRef.current = null;
      sendingRef.current = false;
      setSending(false);
    }
  };

  const stopAndSend = async () => {
    const recorder = recorderRef.current;
    if (!recorder || sendingRef.current || stoppingRef.current) return;
    stoppingRef.current = true;
    setPreparing(true);
    setRecording(false);
    setPaused(false);
    try {
      const voiceNote = await recorder.stop();
      recorderRef.current = null;
      setPrepared(voiceNote);
      setDurationMs(voiceNote.durationMs);
      await sendPrepared(voiceNote);
    } catch (error) {
      onError(
        error instanceof Error
          ? error.message
          : "Voice note could not be prepared",
      );
      await discard();
    } finally {
      stoppingRef.current = false;
      setPreparing(false);
    }
  };

  const start = async () => {
    if (disabled || recording || preparing || sending || stoppingRef.current)
      return;
    onError(null);
    stoppingRef.current = false;
    const recorder = new BrowserVoiceNoteRecorder();
    recorderRef.current = recorder;
    try {
      await recorder.start((nextDuration) => {
        setDurationMs(nextDuration);
        if (nextDuration >= MAX_VOICE_NOTE_DURATION_MS) void stopAndSend();
      });
      setRecording(true);
    } catch (error) {
      recorderRef.current = null;
      onError(
        error instanceof Error ? error.message : "Microphone access failed",
      );
    }
  };

  useEffect(() => {
    const cancelWhenHidden = () => {
      if (document.visibilityState === "hidden") void discard();
    };
    document.addEventListener("visibilitychange", cancelWhenHidden);
    return () =>
      document.removeEventListener("visibilitychange", cancelWhenHidden);
  });

  useEffect(() => {
    if (disabled && recording) void discard();
  }, [disabled, recording]);

  useEffect(
    () => () => {
      recorderRef.current?.cancel();
      abortRef.current?.abort();
      onBusyChange(false);
    },
    [onBusyChange],
  );

  if (!visible && !recording && !preparing && !prepared && !promotedUploadId)
    return null;
  if (!recording && !preparing && !prepared && !promotedUploadId) {
    return (
      <Button
        aria-label="Record voice note"
        disabled={disabled}
        onClick={() => void start()}
        size="icon"
        type="button"
        variant="ghost"
      >
        <Mic aria-hidden />
      </Button>
    );
  }

  const remaining = Math.ceil(
    (MAX_VOICE_NOTE_DURATION_MS - durationMs) / 1_000,
  );
  return (
    <div className="flex min-w-56 flex-1 items-center gap-2 rounded-xl border border-primary/20 bg-primary/5 px-3 py-2">
      <span
        className={`size-2 rounded-full ${recording ? "animate-pulse bg-destructive" : "bg-primary"}`}
        aria-hidden
      />
      <span className="min-w-14 font-mono text-sm" aria-live="polite">
        {preparing
          ? "Preparing..."
          : remaining <= 10
            ? `-${remaining}s`
            : formatDuration(durationMs)}
      </span>
      {recording ? (
        <Button
          aria-label={paused ? "Resume voice note" : "Pause voice note"}
          onClick={() => {
            if (paused) recorderRef.current?.resume();
            else recorderRef.current?.pause();
            setPaused(!paused);
          }}
          size="icon-xs"
          type="button"
          variant="ghost"
        >
          {paused ? <Play aria-hidden /> : <Pause aria-hidden />}
        </Button>
      ) : null}
      <Button
        aria-label="Discard voice note"
        disabled={sending || preparing}
        onClick={() => void discard()}
        size="icon-xs"
        type="button"
        variant="ghost"
      >
        <Trash2 aria-hidden />
      </Button>
      <Button
        aria-label={failed ? "Retry voice note" : "Send voice note"}
        disabled={
          preparing ||
          sending ||
          (recording && durationMs < MIN_VOICE_NOTE_DURATION_MS)
        }
        onClick={() => void (recording ? stopAndSend() : sendPrepared())}
        size="icon-xs"
        type="button"
      >
        {failed ? <RefreshCw aria-hidden /> : <Send aria-hidden />}
      </Button>
    </div>
  );
}
