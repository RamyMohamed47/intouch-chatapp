import type { VoiceNoteDto } from "@intouch/shared/messages";
import { useAudioPlayer, useAudioPlayerStatus } from "expo-audio";
import { Pause, Play } from "lucide-react-native";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  AppState,
  Pressable,
  StyleSheet,
  Text,
  View,
  type AccessibilityActionEvent,
  type GestureResponderEvent,
} from "react-native";

import { useAppearance } from "@/features/appearance/appearance-provider";
import { uploadsApi } from "@/features/uploads/uploads-api";
import { useVoice } from "@/features/voice/voice-provider";
import {
  replaceAudioSourceAndWait,
  sanitizeVoiceNotePlaybackError,
} from "@/features/voice-notes/voice-note-playback";

let stopActivePlayer: (() => void) | null = null;

const formatDuration = (seconds: number) =>
  `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, "0")}`;

export const VoiceNotePlayer = ({ voiceNote }: { voiceNote: VoiceNoteDto }) => {
  const { theme } = useAppearance();
  const voice = useVoice();
  const player = useAudioPlayer(null, { updateInterval: 100 });
  const status = useAudioPlayerStatus(player);
  const refreshedRef = useRef(false);
  const retryingRef = useRef(false);
  const [waveformWidth, setWaveformWidth] = useState(1);
  const [loaded, setLoaded] = useState(false);
  const [rate, setRate] = useState<1 | 1.5 | 2>(1);
  const [error, setError] = useState<string | null>(null);

  const reset = useCallback(() => {
    try {
      player.pause();
      void player.seekTo(0).catch(() => undefined);
    } catch {
      // Native shared objects can already be released during teardown.
    }
  }, [player]);

  const load = useCallback(
    async (refresh = false) => {
      if (loaded && !refresh) return;
      const { accessUrl } = await uploadsApi.access(voiceNote.assetId);
      setLoaded(false);
      await replaceAudioSourceAndWait(player, accessUrl);
      player.setPlaybackRate(rate);
      setLoaded(true);
    },
    [loaded, player, rate, voiceNote.assetId],
  );

  const toggle = async () => {
    setError(null);
    refreshedRef.current = false;
    try {
      if (status.playing) {
        player.pause();
        return;
      }
      await load();
      if (stopActivePlayer !== reset) stopActivePlayer?.();
      stopActivePlayer = reset;
      player.play();
    } catch (caught) {
      if (!refreshedRef.current) {
        refreshedRef.current = true;
        try {
          await load(true);
          if (stopActivePlayer !== reset) stopActivePlayer?.();
          stopActivePlayer = reset;
          player.play();
          return;
        } catch (retryError) {
          if (__DEV__) {
            console.error("Voice-note playback failed after refresh", {
              error: sanitizeVoiceNotePlaybackError(retryError),
              stage: "load-or-play",
            });
          }
          // The user-facing failure below covers both access and playback errors.
        }
      }
      if (__DEV__) {
        console.error("Voice-note playback failed", {
          error: sanitizeVoiceNotePlaybackError(caught),
          stage: "load-or-play",
        });
      }
      setError("Voice note could not be played");
    }
  };

  useEffect(() => {
    if (voice.activeSession) reset();
  }, [reset, voice.activeSession]);

  useEffect(() => {
    const subscription = AppState.addEventListener("change", (next) => {
      if (next !== "active") reset();
    });
    return () => {
      subscription.remove();
      if (stopActivePlayer === reset) stopActivePlayer = null;
      reset();
    };
  }, [reset]);

  useEffect(() => {
    if (!status.error || retryingRef.current) return;
    if (refreshedRef.current) {
      if (__DEV__) {
        console.error("Voice-note decoder reported an error", {
          error: sanitizeVoiceNotePlaybackError(status.error),
          playbackState: status.playbackState,
          stage: "playback",
        });
      }
      setError("Voice note could not be played");
      return;
    }

    refreshedRef.current = true;
    retryingRef.current = true;
    void load(true)
      .then(() => {
        if (stopActivePlayer !== reset) stopActivePlayer?.();
        stopActivePlayer = reset;
        player.play();
      })
      .catch((caught: unknown) => {
        if (__DEV__) {
          console.error("Voice-note playback refresh failed", {
            error: sanitizeVoiceNotePlaybackError(caught),
            playbackState: status.playbackState,
            stage: "refresh",
          });
        }
        setError("Voice note could not be played");
      })
      .finally(() => {
        retryingRef.current = false;
      });
  }, [load, player, reset, status.error]);

  const duration = voiceNote.durationMs / 1_000;
  const seekTo = (next: number) => {
    const bounded = Math.max(0, Math.min(duration, next));
    void player.seekTo(bounded).catch(() => undefined);
  };
  const seek = (event: GestureResponderEvent) => {
    seekTo((event.nativeEvent.locationX / waveformWidth) * duration);
  };
  const adjustSeek = (event: AccessibilityActionEvent) => {
    if (event.nativeEvent.actionName === "increment") {
      seekTo(status.currentTime + 5);
    } else if (event.nativeEvent.actionName === "decrement") {
      seekTo(status.currentTime - 5);
    }
  };

  return (
    <View
      style={[
        styles.container,
        { backgroundColor: theme.accentSoft, borderColor: theme.border },
      ]}
    >
      <Pressable
        accessibilityLabel={
          status.playing ? "Pause voice note" : "Play voice note"
        }
        accessibilityRole="button"
        onPress={() => void toggle()}
        style={[styles.play, { backgroundColor: theme.accent }]}
      >
        {status.playing ? (
          <Pause color="#ffffff" size={19} />
        ) : (
          <Play color="#ffffff" size={19} />
        )}
      </Pressable>
      <Pressable
        accessibilityActions={[
          { name: "increment", label: "Seek forward five seconds" },
          { name: "decrement", label: "Seek backward five seconds" },
        ]}
        accessibilityLabel="Seek voice note"
        accessibilityRole="adjustable"
        accessibilityValue={{
          min: 0,
          max: Math.round(duration),
          now: Math.round(status.currentTime),
          text: `${formatDuration(status.currentTime)} of ${formatDuration(duration)}`,
        }}
        onLayout={(event) => setWaveformWidth(event.nativeEvent.layout.width)}
        onAccessibilityAction={adjustSeek}
        onPress={seek}
        style={styles.waveform}
      >
        {voiceNote.waveform.map((peak, index) => (
          <View
            key={index}
            style={[
              styles.bar,
              {
                backgroundColor:
                  index / voiceNote.waveform.length <=
                  status.currentTime / duration
                    ? theme.accent
                    : theme.muted,
                height: `${Math.max(10, peak)}%`,
              },
            ]}
          />
        ))}
      </Pressable>
      <Text style={[styles.time, { color: theme.muted }]}>
        {formatDuration(status.currentTime)} / {formatDuration(duration)}
      </Text>
      <Pressable
        accessibilityLabel={`Playback speed ${rate} times`}
        accessibilityRole="button"
        onPress={() => {
          const next = rate === 1 ? 1.5 : rate === 1.5 ? 2 : 1;
          setRate(next);
          player.setPlaybackRate(next);
        }}
        style={styles.speed}
      >
        <Text style={{ color: theme.text, fontWeight: "900" }}>{rate}x</Text>
      </Pressable>
      {error ? (
        <Text style={{ color: theme.danger, fontSize: 12 }}>{error}</Text>
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  bar: { borderRadius: 2, flex: 1, minWidth: 1 },
  container: {
    alignItems: "center",
    borderRadius: 14,
    borderWidth: 1,
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    minWidth: 280,
    padding: 9,
  },
  play: {
    alignItems: "center",
    borderRadius: 19,
    height: 38,
    justifyContent: "center",
    width: 38,
  },
  speed: {
    alignItems: "center",
    minHeight: 44,
    minWidth: 44,
    justifyContent: "center",
  },
  time: { fontFamily: "monospace", fontSize: 11 },
  waveform: {
    alignItems: "center",
    flex: 1,
    flexDirection: "row",
    gap: 1,
    height: 44,
    minWidth: 120,
  },
});
