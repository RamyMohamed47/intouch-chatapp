import type { MessageDto } from "@intouch/shared/messages";
import {
  MAX_VOICE_NOTE_DURATION_MS,
  MIN_VOICE_NOTE_DURATION_MS,
} from "@intouch/shared/uploads";
import {
  AudioQuality,
  IOSOutputFormat,
  requestRecordingPermissionsAsync,
  setAudioModeAsync,
  useAudioRecorder,
  type AudioRecorder,
  type RecorderState,
  type RecordingOptions,
} from "expo-audio";
import * as FileSystem from "expo-file-system/legacy";
import { Mic, Pause, Play, RefreshCw, Send, Trash2 } from "lucide-react-native";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  AppState,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { useAppearance } from "@/features/appearance/appearance-provider";
import { messagesApi } from "@/features/messages/messages-api";
import { uploadFiles } from "@/features/uploads/upload-client";
import { uploadsApi } from "@/features/uploads/uploads-api";
import {
  meteringToPeak,
  normalizeVoiceNoteWaveform,
} from "@/features/voice-notes/voice-note-waveform";

const RECORDING_OPTIONS: RecordingOptions = {
  directory: "cache",
  extension: ".m4a",
  sampleRate: 32_000,
  numberOfChannels: 1,
  bitRate: 64_000,
  isMeteringEnabled: true,
  android: {
    extension: ".m4a",
    outputFormat: "mpeg4",
    audioEncoder: "aac",
    sampleRate: 32_000,
    maxFileSize: 5 * 1024 * 1024,
  },
  ios: {
    extension: ".m4a",
    outputFormat: IOSOutputFormat.MPEG4AAC,
    audioQuality: AudioQuality.HIGH,
    sampleRate: 32_000,
  },
  web: { mimeType: "audio/mp4", bitsPerSecond: 64_000 },
};

const formatDuration = (durationMs: number) =>
  `${Math.floor(durationMs / 60_000)}:${String(Math.floor((durationMs % 60_000) / 1_000)).padStart(2, "0")}`;

type NativeVoiceNoteRecorder = Pick<
  AudioRecorder,
  | "getStatus"
  | "isRecording"
  | "pause"
  | "prepareToRecordAsync"
  | "record"
  | "stop"
  | "uri"
>;

const INITIAL_RECORDER_STATE: RecorderState = {
  canRecord: false,
  durationMillis: 0,
  isRecording: false,
  mediaServicesDidReset: false,
  url: null,
};

export const VoiceNoteRecorder = ({
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
  onError: (message: string) => void;
  onSent: (message: MessageDto) => void;
  replyToMessageId?: string;
  visible: boolean;
}) => {
  const { theme } = useAppearance();
  const nativeRecorder = useAudioRecorder(RECORDING_OPTIONS);
  const recorder: NativeVoiceNoteRecorder = nativeRecorder;
  const [state, setState] = useState<RecorderState>(INITIAL_RECORDER_STATE);
  const samplesRef = useRef<number[]>([]);
  const sendingRef = useRef(false);
  const preparingRef = useRef(false);
  const recordingRef = useRef(false);
  const autoSendingRef = useRef(false);
  const durationRef = useRef(0);
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const activeRecordingUriRef = useRef<string | null>(null);
  const preparedUriRef = useRef<string | null>(null);
  const promotedUploadIdRef = useRef<string | null>(null);
  const [paused, setPaused] = useState(false);
  const [recording, setRecording] = useState(false);
  const [preparing, setPreparing] = useState(false);
  const [sending, setSending] = useState(false);
  const [failed, setFailed] = useState(false);
  const [prepared, setPrepared] = useState<{
    durationMs: number;
    size: number;
    uri: string;
    waveform: number[];
  } | null>(null);
  const [promotedUploadId, setPromotedUploadId] = useState<string | null>(null);
  preparedUriRef.current = prepared?.uri ?? null;
  promotedUploadIdRef.current = promotedUploadId;

  const stopPolling = useCallback(() => {
    if (pollingRef.current) clearInterval(pollingRef.current);
    pollingRef.current = null;
  }, []);

  const pollRecorder = useCallback(() => {
    if (!recordingRef.current) return;
    try {
      const next = recorder.getStatus();
      durationRef.current = Math.max(durationRef.current, next.durationMillis);
      setState(next);
      if (next.metering !== undefined) {
        samplesRef.current.push(meteringToPeak(next.metering));
      }
      if (
        !next.isRecording &&
        next.durationMillis >= MAX_VOICE_NOTE_DURATION_MS - 500
      ) {
        stopPolling();
      }
    } catch {
      stopPolling();
    }
  }, [recorder, stopPolling]);

  const startPolling = useCallback(() => {
    stopPolling();
    pollRecorder();
    pollingRef.current = setInterval(pollRecorder, 100);
  }, [pollRecorder, stopPolling]);

  const deleteLocal = async (uri?: string | null) => {
    if (!uri) return;
    await FileSystem.deleteAsync(uri, { idempotent: true }).catch(
      () => undefined,
    );
  };

  const restorePlaybackMode = () =>
    setAudioModeAsync({
      allowsRecording: false,
      allowsBackgroundRecording: false,
      playsInSilentMode: true,
    }).catch(() => undefined);

  const discard = useCallback(async () => {
    const wasRecording = recordingRef.current;
    recordingRef.current = false;
    preparingRef.current = false;
    stopPolling();
    if (wasRecording) await recorder.stop().catch(() => undefined);
    await restorePlaybackMode();
    await deleteLocal(prepared?.uri ?? activeRecordingUriRef.current);
    if (promotedUploadId) {
      await uploadsApi.cancel(promotedUploadId).catch(() => undefined);
    }
    samplesRef.current = [];
    autoSendingRef.current = false;
    durationRef.current = 0;
    activeRecordingUriRef.current = null;
    setPaused(false);
    setRecording(false);
    setPreparing(false);
    setSending(false);
    setFailed(false);
    setState(INITIAL_RECORDER_STATE);
    setPrepared(null);
    setPromotedUploadId(null);
    onBusyChange(false);
  }, [onBusyChange, prepared?.uri, promotedUploadId, recorder, stopPolling]);

  const sendPrepared = useCallback(
    async (nextPrepared?: NonNullable<typeof prepared>) => {
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
      let sentMessage: MessageDto | null = null;
      try {
        let uploadId = promotedUploadId;
        if (!uploadId) {
          const completed = await uploadFiles({
            purpose: "VOICE_NOTE",
            conversationId,
            files: [
              {
                contentType: "audio/mp4",
                durationMs: voiceNote.durationMs,
                fileName: "voice-note.m4a",
                size: voiceNote.size,
                uri: voiceNote.uri,
                waveform: voiceNote.waveform,
              },
            ],
          });
          uploadId = completed[0] ?? null;
          if (!uploadId) throw new Error("Voice-note upload did not complete");
          setPromotedUploadId(uploadId);
        }
        const message = await messagesApi.create(conversationId, {
          voiceNoteUploadId: uploadId,
          ...(replyToMessageId ? { replyToMessageId } : {}),
        });
        await deleteLocal(voiceNote.uri);
        setPrepared(null);
        setPromotedUploadId(null);
        setFailed(false);
        sentMessage = message;
      } catch (error) {
        setFailed(true);
        onError(
          error instanceof Error
            ? error.message
            : "Voice note could not be sent",
        );
      } finally {
        sendingRef.current = false;
        setSending(false);
      }
      if (sentMessage) {
        durationRef.current = 0;
        activeRecordingUriRef.current = null;
        setState(INITIAL_RECORDER_STATE);
        onBusyChange(false);
        onSent(sentMessage);
      }
    },
    [
      conversationId,
      discard,
      onError,
      onSent,
      onBusyChange,
      prepared,
      promotedUploadId,
      replyToMessageId,
    ],
  );

  const stopAndSend = useCallback(async () => {
    if (!recordingRef.current || preparingRef.current || sendingRef.current)
      return;
    preparingRef.current = true;
    recordingRef.current = false;
    stopPolling();
    const capturedDurationMs = Math.min(
      MAX_VOICE_NOTE_DURATION_MS,
      Math.max(durationRef.current, state.durationMillis),
    );
    const capturedUri = activeRecordingUriRef.current ?? recorder.uri;
    setRecording(false);
    setPaused(false);
    setPreparing(true);
    try {
      if (recorder.isRecording) await recorder.stop();
      await restorePlaybackMode();
      const uri = recorder.uri ?? capturedUri;
      if (!uri) throw new Error("The recorded voice note is unavailable");
      const info = await FileSystem.getInfoAsync(uri);
      if (!info.exists || typeof info.size !== "number") {
        throw new Error("The recorded voice note is unavailable");
      }
      const next = {
        durationMs: capturedDurationMs,
        size: info.size,
        uri,
        waveform: normalizeVoiceNoteWaveform(samplesRef.current),
      };
      setPrepared(next);
      preparingRef.current = false;
      setPreparing(false);
      await sendPrepared(next);
    } catch (error) {
      onError(
        error instanceof Error
          ? error.message
          : "Voice note could not be prepared",
      );
      await discard();
    } finally {
      preparingRef.current = false;
      setPreparing(false);
    }
  }, [
    discard,
    onError,
    recorder,
    recording,
    sendPrepared,
    state.durationMillis,
    stopPolling,
  ]);

  useEffect(() => {
    if (!recording || paused) return;
    if (
      state.durationMillis >= MAX_VOICE_NOTE_DURATION_MS &&
      !autoSendingRef.current
    ) {
      autoSendingRef.current = true;
      void stopAndSend();
    }
  }, [paused, recording, state.durationMillis, state.metering, stopAndSend]);

  useEffect(() => {
    if (
      recording &&
      !paused &&
      !state.isRecording &&
      state.durationMillis >= MAX_VOICE_NOTE_DURATION_MS - 500 &&
      !autoSendingRef.current
    ) {
      autoSendingRef.current = true;
      void stopAndSend();
    }
  }, [paused, recording, state.durationMillis, state.isRecording, stopAndSend]);

  useEffect(() => {
    onBusyChange(
      recording ||
        preparing ||
        sending ||
        prepared !== null ||
        promotedUploadId !== null,
    );
  }, [onBusyChange, prepared, preparing, promotedUploadId, recording, sending]);

  useEffect(() => {
    const subscription = AppState.addEventListener("change", (next) => {
      if (next !== "active" && recordingRef.current) void discard();
    });
    return () => subscription.remove();
  }, [discard]);

  useEffect(() => {
    if (disabled && recordingRef.current) void discard();
  }, [disabled, discard]);

  useEffect(
    () => () => {
      recordingRef.current = false;
      stopPolling();
      const temporaryUri =
        preparedUriRef.current ?? activeRecordingUriRef.current;
      const promotedUploadId = promotedUploadIdRef.current;
      void (async () => {
        await restorePlaybackMode();
        await new Promise((resolve) => setTimeout(resolve, 250));
        await deleteLocal(temporaryUri);
        if (promotedUploadId) {
          await uploadsApi.cancel(promotedUploadId).catch(() => undefined);
        }
      })();
      onBusyChange(false);
    },
    [onBusyChange, stopPolling],
  );

  const start = async () => {
    if (
      disabled ||
      recordingRef.current ||
      preparingRef.current ||
      sendingRef.current
    )
      return;
    const permission = await requestRecordingPermissionsAsync();
    if (!permission.granted) {
      onError("Microphone permission is required to record a voice note");
      return;
    }
    try {
      await setAudioModeAsync({
        allowsRecording: true,
        allowsBackgroundRecording: false,
        playsInSilentMode: true,
      });
      await recorder.prepareToRecordAsync(RECORDING_OPTIONS);
      samplesRef.current = [];
      autoSendingRef.current = false;
      durationRef.current = 0;
      activeRecordingUriRef.current = recorder.uri;
      setState(INITIAL_RECORDER_STATE);
      recorder.record({ forDuration: MAX_VOICE_NOTE_DURATION_MS / 1_000 });
      recordingRef.current = true;
      onBusyChange(true);
      setRecording(true);
      setPaused(false);
      startPolling();
    } catch (error) {
      onError(
        error instanceof Error
          ? error.message
          : "Microphone could not be started",
      );
      await restorePlaybackMode();
      onBusyChange(false);
    }
  };

  if (
    !visible &&
    !recording &&
    !preparing &&
    !sending &&
    !prepared &&
    !promotedUploadId
  )
    return null;
  if (!recording && !preparing && !sending && !prepared && !promotedUploadId) {
    return (
      <Pressable
        accessibilityLabel="Record voice note"
        accessibilityRole="button"
        disabled={disabled}
        onPress={() => void start()}
        style={styles.iconButton}
      >
        <Mic color={disabled ? theme.muted : theme.accent} size={23} />
      </Pressable>
    );
  }

  const displayDurationMs =
    prepared?.durationMs ?? Math.max(durationRef.current, state.durationMillis);
  if (preparing || sending) {
    return (
      <View style={[styles.controls, { borderColor: theme.accentSoft }]}>
        <ActivityIndicator color={theme.accent} size="small" />
        <View style={styles.pendingCopy}>
          <Text
            accessibilityLiveRegion="polite"
            style={[styles.pendingLabel, { color: theme.text }]}
          >
            {preparing ? "Preparing voice note..." : "Sending voice note..."}
          </Text>
          <Text style={[styles.time, { color: theme.muted }]}>
            {formatDuration(displayDurationMs)}
          </Text>
        </View>
      </View>
    );
  }

  const remaining = Math.ceil(
    (MAX_VOICE_NOTE_DURATION_MS - state.durationMillis) / 1_000,
  );
  return (
    <View style={[styles.controls, { borderColor: theme.accentSoft }]}>
      <View style={[styles.indicator, { backgroundColor: theme.danger }]} />
      <Text
        accessibilityLiveRegion="polite"
        style={[styles.time, { color: theme.text }]}
      >
        {recording && remaining <= 10
          ? `-${remaining}s`
          : formatDuration(displayDurationMs)}
      </Text>
      {recording ? (
        <Pressable
          accessibilityLabel={paused ? "Resume voice note" : "Pause voice note"}
          onPress={() => {
            if (paused) recorder.record();
            else recorder.pause();
            setPaused(!paused);
          }}
          style={styles.iconButton}
        >
          {paused ? (
            <Play color={theme.text} size={21} />
          ) : (
            <Pause color={theme.text} size={21} />
          )}
        </Pressable>
      ) : null}
      <Pressable
        accessibilityLabel="Discard voice note"
        disabled={sending}
        onPress={() => void discard()}
        style={styles.iconButton}
      >
        <Trash2 color={theme.danger} size={21} />
      </Pressable>
      <Pressable
        accessibilityLabel={failed ? "Retry voice note" : "Send voice note"}
        disabled={
          sending ||
          (recording && state.durationMillis < MIN_VOICE_NOTE_DURATION_MS)
        }
        onPress={() => void (recording ? stopAndSend() : sendPrepared())}
        style={[styles.send, { backgroundColor: theme.accent }]}
      >
        {failed ? (
          <RefreshCw color="#ffffff" size={20} />
        ) : (
          <Send color="#ffffff" size={20} />
        )}
      </Pressable>
    </View>
  );
};

const styles = StyleSheet.create({
  controls: {
    alignItems: "center",
    borderRadius: 16,
    borderWidth: 1,
    flex: 1,
    flexDirection: "row",
    gap: 7,
    minHeight: 48,
    paddingHorizontal: 10,
  },
  iconButton: {
    alignItems: "center",
    height: 44,
    justifyContent: "center",
    width: 44,
  },
  indicator: { borderRadius: 5, height: 10, width: 10 },
  pendingCopy: { flex: 1, gap: 2 },
  pendingLabel: { fontSize: 13, fontWeight: "800" },
  time: { flex: 1, fontFamily: "monospace", fontSize: 13 },
  send: {
    alignItems: "center",
    borderRadius: 22,
    height: 44,
    justifyContent: "center",
    width: 44,
  },
});
