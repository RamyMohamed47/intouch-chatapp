import {
  AudioSession,
  RoomContext,
  registerGlobals,
} from "@livekit/react-native";
import {
  CallMediaMode,
  CallStatus,
  VoiceSessionKind,
  type CallDto,
  type CallMediaModeValue,
  type VoiceCredentialsDto,
  type VoiceSessionDto,
} from "@intouch/shared/voice";
import { useQueryClient } from "@tanstack/react-query";
import { useAudioPlayer } from "expo-audio";
import { router } from "expo-router";
import { ConnectionState, Room, RoomEvent, Track } from "livekit-client";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type PropsWithChildren,
} from "react";
import { AppState, LogBox, Platform } from "react-native";

import { useAuth } from "@/features/auth/auth-provider";
import {
  getForegroundNotificationPreferences,
  shouldShowForegroundCall,
} from "@/features/notifications/foreground-notification-policy";
import { useRealtime } from "@/features/realtime/realtime-provider";
import { voiceApi } from "@/features/voice/voice-api";
import incomingCallTone from "@/assets/audio/intouch_call.wav";
import outgoingRingbackTone from "@/assets/audio/intouch-ringback.wav";
import { voiceForegroundService } from "@/features/voice/voice-foreground-service";
import {
  canPublishScreenShare,
  mobileVoiceRoomOptions,
  shouldStopCameraForAppState,
  voiceHeartbeatDelayMs,
  voiceSessionRestoreAction,
} from "@/features/voice/voice-policy";

registerGlobals();

if (__DEV__) {
  // React Native can report a WebSocket failure after an intentional close.
  // Actual terminal room disconnects are surfaced through provider state below.
  LogBox.ignoreLogs(["error reading from signal stream"]);
}

type VoiceConnectionState =
  "idle" | "connecting" | "connected" | "reconnecting";

interface VoiceContextValue {
  activeCall: CallDto | null;
  activeSession: VoiceSessionDto | null;
  audioOutputs: readonly string[];
  cameraEnabled: boolean;
  connectionState: VoiceConnectionState;
  deafened: boolean;
  error: string | null;
  incomingCall: CallDto | null;
  muted: boolean;
  participantsVersion: number;
  screenShareEnabled: boolean;
  selectedAudioOutput: string | null;
  acceptCall: (callId: string) => Promise<void>;
  acceptIncoming: () => Promise<void>;
  cancelCall: () => Promise<void>;
  declineCall: (callId: string) => Promise<void>;
  declineIncoming: () => Promise<void>;
  disconnectParticipant: (userId: string) => Promise<void>;
  endCall: () => Promise<void>;
  joinChannel: (conversationId: string, replace?: boolean) => Promise<void>;
  handleCallPush: (callId: string, incoming: boolean) => Promise<void>;
  leave: () => Promise<void>;
  muteParticipant: (userId: string) => Promise<void>;
  openActiveSession: () => void;
  room: Room;
  selectAudioOutput: (output: string) => Promise<void>;
  startCall: (
    conversationId: string,
    mediaMode: CallMediaModeValue,
    replace?: boolean,
  ) => Promise<void>;
  stopParticipantScreenShare: (userId: string) => Promise<void>;
  toggleCamera: () => Promise<void>;
  toggleDeafen: () => void;
  toggleMicrophone: () => Promise<void>;
  toggleScreenShare: () => Promise<void>;
}

const VoiceContext = createContext<VoiceContextValue | null>(null);

const terminalCall = (call: CallDto) => call.status === CallStatus.ENDED;

const shouldInterruptIncomingCall = (call: CallDto) =>
  shouldShowForegroundCall(
    {
      type: "CALL_INCOMING",
      organizationId: call.organizationId,
      conversationId: call.conversationId,
    },
    getForegroundNotificationPreferences(),
  );

const stopAudioPlayer = (player: ReturnType<typeof useAudioPlayer>) => {
  try {
    player.pause();
  } catch {
    return;
  }
  try {
    void player.seekTo(0).catch(() => undefined);
  } catch {
    // Expo releases hook-owned players automatically during unmount.
  }
};

// Development-only. Counts only: identities, tokens, room names, and member
// details must never reach a log.
const logVoiceDiagnostics = (room: Room, stage: string) => {
  if (!__DEV__) return;
  const remotes = [...room.remoteParticipants.values()];
  console.log("[voice]", stage, {
    connectionState: room.state,
    hasLocalIdentity: Boolean(room.localParticipant.identity),
    remoteParticipants: remotes.length,
    remotePublications: remotes.reduce(
      (total, participant) => total + participant.trackPublications.size,
      0,
    ),
    subscribedPublications: remotes.reduce(
      (total, participant) =>
        total +
        [...participant.trackPublications.values()].filter(
          (publication) => publication.isSubscribed,
        ).length,
      0,
    ),
  });
};

export const VoiceProvider = ({ children }: PropsWithChildren) => {
  const { status, user } = useAuth();
  const { heartbeatVoice, setVoiceSessionActive, subscribeVoice } =
    useRealtime();
  const queryClient = useQueryClient();
  const [room] = useState(() => new Room(mobileVoiceRoomOptions));
  const [activeSession, setActiveSession] = useState<VoiceSessionDto | null>(
    null,
  );
  const [activeCall, setActiveCall] = useState<CallDto | null>(null);
  const [incomingCall, setIncomingCall] = useState<CallDto | null>(null);
  const [audioOutputs, setAudioOutputs] = useState<readonly string[]>([]);
  const [selectedAudioOutput, setSelectedAudioOutput] = useState<string | null>(
    null,
  );
  const [connectionState, setConnectionState] =
    useState<VoiceConnectionState>("idle");
  const [muted, setMuted] = useState(false);
  const [deafened, setDeafened] = useState(false);
  const [cameraEnabled, setCameraEnabled] = useState(false);
  const [screenShareEnabled, setScreenShareEnabled] = useState(false);
  const [participantsVersion, setParticipantsVersion] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const admissionRef = useRef(false);
  const cameraTransitionRef = useRef(false);
  const connectingRef = useRef(false);
  const disconnectingRef = useRef<Promise<void> | null>(null);
  const screenShareTransitionRef = useRef(false);
  const ringtone = useAudioPlayer(incomingCallTone);
  const ringback = useAudioPlayer(outgoingRingbackTone);

  const reportError = useCallback((caught: unknown, fallback: string) => {
    setError(caught instanceof Error ? caught.message : fallback);
  }, []);

  const stopTones = useCallback(() => {
    stopAudioPlayer(ringtone);
    stopAudioPlayer(ringback);
  }, [ringback, ringtone]);

  const disconnectRoom = useCallback(async () => {
    if (disconnectingRef.current) return disconnectingRef.current;
    const operation = (async () => {
      stopTones();
      if (room.state !== ConnectionState.Disconnected) {
        await room.disconnect().catch(() => undefined);
      }
      await AudioSession.stopAudioSession().catch(() => undefined);
      await voiceForegroundService.stop().catch(() => undefined);
      setVoiceSessionActive(false);
      setConnectionState("idle");
      setMuted(false);
      setDeafened(false);
      setCameraEnabled(false);
      setScreenShareEnabled(false);
      setAudioOutputs([]);
      setSelectedAudioOutput(null);
    })();
    disconnectingRef.current = operation;
    try {
      await operation;
    } finally {
      if (disconnectingRef.current === operation) {
        disconnectingRef.current = null;
      }
    }
  }, [room, setVoiceSessionActive, stopTones]);

  const connect = useCallback(
    async (
      session: VoiceSessionDto,
      credentials: VoiceCredentialsDto,
      options: { camera: boolean },
    ) => {
      if (connectingRef.current) {
        throw new Error("A voice connection is already in progress");
      }
      connectingRef.current = true;
      setError(null);
      setConnectionState("connecting");
      setVoiceSessionActive(true);
      try {
        await voiceForegroundService.start();
        await AudioSession.startAudioSession();
        if (room.state !== ConnectionState.Disconnected) {
          await room.disconnect();
        }
        await room.connect(credentials.serverUrl, credentials.token, {
          autoSubscribe: true,
        });
        await room.localParticipant.setMicrophoneEnabled(true);
        setAudioOutputs(await AudioSession.getAudioOutputs().catch(() => []));
        setMuted(false);
        if (options.camera) {
          try {
            await room.localParticipant.setCameraEnabled(true);
            setCameraEnabled(true);
          } catch {
            setCameraEnabled(false);
          }
        }
        // The API only marks a session connected once its identity is visible
        // in the provider room, so the session (and the heartbeat it starts)
        // must not be published before the join lands.
        setActiveSession(session);
        setConnectionState("connected");
        logVoiceDiagnostics(room, "connected");
      } catch (caught) {
        await disconnectRoom();
        await voiceApi.leaveSession().catch(() => undefined);
        setActiveSession(null);
        setError(
          caught instanceof Error
            ? caught.message
            : "The media session could not be connected",
        );
        throw caught;
      } finally {
        connectingRef.current = false;
      }
    },
    [disconnectRoom, room, setVoiceSessionActive],
  );

  const joinChannel = useCallback(
    async (conversationId: string, replace = false) => {
      if (admissionRef.current) return;
      admissionRef.current = true;
      try {
        const joined = await voiceApi.joinChannel(conversationId, replace);
        setActiveCall(null);
        await connect(joined.session, joined.credentials, { camera: false });
      } finally {
        admissionRef.current = false;
      }
    },
    [connect],
  );

  const startCall = useCallback(
    async (
      conversationId: string,
      mediaMode: CallMediaModeValue,
      replace = false,
    ) => {
      if (admissionRef.current) return;
      admissionRef.current = true;
      try {
        const started = await voiceApi.startCall(
          conversationId,
          mediaMode,
          replace,
        );
        const { session } = await voiceApi.activeSession();
        if (!session) throw new Error("Call session is unavailable");
        setActiveCall(started.call);
        await connect(session, started.credentials, {
          camera: mediaMode === CallMediaMode.VIDEO,
        });
        router.push({
          pathname: "/call/[callId]" as never,
          params: { callId: started.call.id },
        });
      } finally {
        admissionRef.current = false;
      }
    },
    [connect],
  );

  const acceptCall = useCallback(
    async (callId: string) => {
      if (admissionRef.current) return;
      admissionRef.current = true;
      setError(null);
      try {
        const accepted = await voiceApi.acceptCall(callId);
        const { session } = await voiceApi.activeSession();
        if (!session) throw new Error("Call session is unavailable");
        setIncomingCall(null);
        setActiveCall(accepted.call);
        await connect(session, accepted.credentials, {
          camera: accepted.call.mediaMode === CallMediaMode.VIDEO,
        });
        router.push({
          pathname: "/call/[callId]" as never,
          params: { callId: accepted.call.id },
        });
      } catch (caught) {
        reportError(caught, "The call could not be accepted");
      } finally {
        admissionRef.current = false;
      }
    },
    [connect, reportError],
  );

  const acceptIncoming = useCallback(async () => {
    if (incomingCall) await acceptCall(incomingCall.id);
  }, [acceptCall, incomingCall]);

  const declineCall = useCallback(
    async (callId: string) => {
      setError(null);
      try {
        await voiceApi.declineCall(callId);
        setIncomingCall(null);
        stopTones();
      } catch (caught) {
        reportError(caught, "The call could not be declined");
      }
    },
    [reportError, stopTones],
  );

  const declineIncoming = useCallback(async () => {
    if (incomingCall) await declineCall(incomingCall.id);
  }, [declineCall, incomingCall]);

  const leave = useCallback(async () => {
    await disconnectRoom();
    await voiceApi.leaveSession().catch(() => undefined);
    setActiveSession(null);
    setActiveCall(null);
  }, [disconnectRoom]);

  const endCall = useCallback(async () => {
    await disconnectRoom();
    if (activeCall && !terminalCall(activeCall)) {
      await voiceApi.endCall(activeCall.id).catch(() => undefined);
    } else {
      await voiceApi.leaveSession().catch(() => undefined);
    }
    setActiveSession(null);
    setActiveCall(null);
  }, [activeCall, disconnectRoom]);

  const cancelCall = useCallback(async () => {
    await disconnectRoom();
    if (activeCall?.status === CallStatus.RINGING) {
      await voiceApi.cancelCall(activeCall.id).catch(() => undefined);
    } else {
      await voiceApi.leaveSession().catch(() => undefined);
    }
    setActiveSession(null);
    setActiveCall(null);
  }, [activeCall, disconnectRoom]);

  const toggleMicrophone = useCallback(async () => {
    setError(null);
    try {
      const enabled = muted;
      await room.localParticipant.setMicrophoneEnabled(enabled);
      setMuted(!enabled);
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "The microphone could not be changed",
      );
    }
  }, [muted, room.localParticipant]);

  const toggleCamera = useCallback(async () => {
    if (cameraTransitionRef.current) return;
    cameraTransitionRef.current = true;
    setError(null);
    try {
      const enabled = !room.localParticipant.isCameraEnabled;
      await room.localParticipant.setCameraEnabled(enabled);
      setCameraEnabled(enabled);
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "The camera could not be changed",
      );
    } finally {
      cameraTransitionRef.current = false;
    }
  }, [room.localParticipant]);

  const toggleScreenShare = useCallback(async () => {
    if (!canPublishScreenShare(Platform.OS)) {
      setError("Starting screen share is currently available on Android");
      return;
    }
    if (screenShareTransitionRef.current) return;
    screenShareTransitionRef.current = true;
    setError(null);
    try {
      const enabled = !room.localParticipant.isScreenShareEnabled;
      const publication = await room.localParticipant.setScreenShareEnabled(
        enabled,
        {
          audio: false,
          contentHint: "detail",
        },
      );
      const activePublication =
        publication ??
        room.localParticipant.getTrackPublication(Track.Source.ScreenShare);
      const isEnabled = Boolean(
        activePublication?.videoTrack && !activePublication.isMuted,
      );
      setScreenShareEnabled(isEnabled);
      if (enabled && !isEnabled) {
        throw new Error("Screen sharing did not start on this device");
      }
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Screen sharing could not be changed",
      );
    } finally {
      screenShareTransitionRef.current = false;
    }
  }, [room.localParticipant]);

  const selectAudioOutput = useCallback(async (output: string) => {
    setError(null);
    try {
      await AudioSession.selectAudioOutput(output);
      setSelectedAudioOutput(output);
      setAudioOutputs(await AudioSession.getAudioOutputs());
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "The audio output could not be changed",
      );
    }
  }, []);

  const toggleDeafen = useCallback(() => {
    const next = !deafened;
    for (const participant of room.remoteParticipants.values()) {
      participant.setVolume(next ? 0 : 1);
    }
    setDeafened(next);
  }, [deafened, room.remoteParticipants]);

  const muteParticipant = useCallback(
    async (userId: string) => {
      if (!activeSession) return;
      setError(null);
      try {
        await voiceApi.muteParticipant(activeSession.conversationId, userId);
      } catch (caught) {
        reportError(caught, "The participant could not be muted");
      }
    },
    [activeSession, reportError],
  );
  const disconnectParticipant = useCallback(
    async (userId: string) => {
      if (!activeSession) return;
      setError(null);
      try {
        await voiceApi.disconnectParticipant(
          activeSession.conversationId,
          userId,
        );
      } catch (caught) {
        reportError(caught, "The participant could not be disconnected");
      }
    },
    [activeSession, reportError],
  );
  const stopParticipantScreenShare = useCallback(
    async (userId: string) => {
      if (!activeSession) return;
      setError(null);
      try {
        await voiceApi.stopScreenShare(activeSession.conversationId, userId);
      } catch (caught) {
        reportError(caught, "The screen share could not be stopped");
      }
    },
    [activeSession, reportError],
  );

  const openActiveSession = useCallback(() => {
    if (!activeSession) return;
    if (activeSession.kind === VoiceSessionKind.CALL && activeSession.callId) {
      router.push({
        pathname: "/call/[callId]" as never,
        params: { callId: activeSession.callId },
      });
    } else {
      router.push(`/conversation/${activeSession.conversationId}`);
    }
  }, [activeSession]);

  const handleCallPush = useCallback(
    async (callId: string, incoming: boolean) => {
      const call = await voiceApi.getCall(callId);
      queryClient.setQueryData(["calls", callId], call);
      if (
        incoming &&
        call.status === CallStatus.RINGING &&
        shouldInterruptIncomingCall(call)
      ) {
        setIncomingCall(call);
      } else {
        if (incomingCall?.id === callId) setIncomingCall(null);
        if (activeCall?.id === callId) setActiveCall(call);
      }
    },
    [activeCall?.id, incomingCall?.id, queryClient],
  );

  useEffect(() => {
    const refreshParticipants = () =>
      setParticipantsVersion((current) => current + 1);
    const refreshMedia = () => {
      refreshParticipants();
      const camera = room.localParticipant.getTrackPublication(
        Track.Source.Camera,
      );
      const screenShare = room.localParticipant.getTrackPublication(
        Track.Source.ScreenShare,
      );
      setCameraEnabled(Boolean(camera?.videoTrack && !camera.isMuted));
      setScreenShareEnabled(
        Boolean(screenShare?.videoTrack && !screenShare.isMuted),
      );
    };
    const connected = () => {
      refreshMedia();
      setConnectionState("connected");
    };
    const participantConnected = () => {
      refreshParticipants();
      logVoiceDiagnostics(room, "participantConnected");
    };
    const reconnecting = () => setConnectionState("reconnecting");
    const disconnected = () => {
      refreshParticipants();
      setConnectionState("idle");
      if (
        !disconnectingRef.current &&
        !connectingRef.current &&
        activeSession
      ) {
        setVoiceSessionActive(false);
        setError("The voice connection ended unexpectedly. Leave and rejoin.");
      }
    };
    const mediaDevicesError = (caught: Error) =>
      reportError(caught, "A camera, microphone, or screen could not be used");
    const trackSubscriptionFailed = () =>
      reportError(
        new Error("A participant's media could not be received"),
        "A participant's media could not be received",
      );
    room.on(RoomEvent.Connected, connected);
    room.on(RoomEvent.Reconnected, connected);
    room.on(RoomEvent.Reconnecting, reconnecting);
    room.on(RoomEvent.Disconnected, disconnected);
    room.on(RoomEvent.ParticipantConnected, participantConnected);
    room.on(RoomEvent.ParticipantDisconnected, refreshParticipants);
    room.on(RoomEvent.TrackPublished, refreshMedia);
    room.on(RoomEvent.TrackUnpublished, refreshMedia);
    room.on(RoomEvent.TrackSubscribed, refreshMedia);
    room.on(RoomEvent.TrackUnsubscribed, refreshMedia);
    room.on(RoomEvent.TrackMuted, refreshMedia);
    room.on(RoomEvent.TrackUnmuted, refreshMedia);
    room.on(RoomEvent.LocalTrackPublished, refreshMedia);
    room.on(RoomEvent.LocalTrackUnpublished, refreshMedia);
    room.on(RoomEvent.ActiveSpeakersChanged, refreshParticipants);
    room.on(RoomEvent.MediaDevicesError, mediaDevicesError);
    room.on(RoomEvent.TrackSubscriptionFailed, trackSubscriptionFailed);
    return () => {
      room.off(RoomEvent.Connected, connected);
      room.off(RoomEvent.Reconnected, connected);
      room.off(RoomEvent.Reconnecting, reconnecting);
      room.off(RoomEvent.Disconnected, disconnected);
      room.off(RoomEvent.ParticipantConnected, participantConnected);
      room.off(RoomEvent.ParticipantDisconnected, refreshParticipants);
      room.off(RoomEvent.TrackPublished, refreshMedia);
      room.off(RoomEvent.TrackUnpublished, refreshMedia);
      room.off(RoomEvent.TrackSubscribed, refreshMedia);
      room.off(RoomEvent.TrackUnsubscribed, refreshMedia);
      room.off(RoomEvent.TrackMuted, refreshMedia);
      room.off(RoomEvent.TrackUnmuted, refreshMedia);
      room.off(RoomEvent.LocalTrackPublished, refreshMedia);
      room.off(RoomEvent.LocalTrackUnpublished, refreshMedia);
      room.off(RoomEvent.ActiveSpeakersChanged, refreshParticipants);
      room.off(RoomEvent.MediaDevicesError, mediaDevicesError);
      room.off(RoomEvent.TrackSubscriptionFailed, trackSubscriptionFailed);
    };
  }, [activeSession, reportError, room, setVoiceSessionActive]);

  useEffect(() => {
    ringtone.loop = true;
    ringtone.volume = 0.64;
    ringback.loop = true;
    ringback.volume = 0.38;
    const incomingRinging = incomingCall?.status === CallStatus.RINGING;
    const outgoingRinging =
      activeCall?.status === CallStatus.RINGING &&
      activeCall.callerUserId === user?.id;
    stopTones();
    if (incomingRinging) ringtone.play();
    else if (outgoingRinging) ringback.play();
  }, [activeCall, incomingCall, ringback, ringtone, stopTones, user?.id]);

  // The first beat runs as soon as the join lands and reconciles the session
  // against the provider room, which is what publishes channel occupancy.
  useEffect(() => {
    if (!activeSession) return;
    let stopped = false;
    let completedAttempts = 0;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const beat = () => {
      void heartbeatVoice(activeSession.id)
        .catch(() => undefined)
        .then(() => {
          if (stopped) return;
          completedAttempts += 1;
          timer = setTimeout(beat, voiceHeartbeatDelayMs(completedAttempts));
        });
    };
    beat();
    return () => {
      stopped = true;
      if (timer) clearTimeout(timer);
    };
  }, [activeSession, heartbeatVoice]);

  useEffect(
    () =>
      subscribeVoice((event) => {
        if (event.kind === "CALL_INCOMING") {
          if (shouldInterruptIncomingCall(event.value.call)) {
            setIncomingCall(event.value.call);
          }
          return;
        }
        if (event.kind === "SCREEN_SHARE_STOP_REQUESTED") {
          if (screenShareEnabled) {
            void room.localParticipant
              .setScreenShareEnabled(false)
              .then(() => setScreenShareEnabled(false))
              .catch((caught: unknown) =>
                reportError(caught, "The screen share could not be stopped"),
              );
          }
          return;
        }
        if (event.kind === "CALL_UPDATED") {
          const call = event.value.call;
          if (incomingCall?.id === call.id) {
            setIncomingCall(terminalCall(call) ? null : call);
          }
          if (activeCall?.id === call.id) {
            setActiveCall(call);
            if (terminalCall(call)) {
              void disconnectRoom().then(() => setActiveSession(null));
            }
          }
        }
      }),
    [
      activeCall?.id,
      disconnectRoom,
      incomingCall?.id,
      reportError,
      room.localParticipant,
      screenShareEnabled,
      subscribeVoice,
    ],
  );

  useEffect(() => {
    if (status !== "authenticated") {
      setIncomingCall(null);
      setActiveCall(null);
      setActiveSession(null);
      void disconnectRoom();
      return;
    }
    let cancelled = false;
    void voiceApi
      .activeSession()
      .then(async ({ session }) => {
        if (cancelled || !session) return;
        let call: CallDto | null = null;
        if (session.kind === VoiceSessionKind.CALL && session.callId) {
          call = await voiceApi.getCall(session.callId);
          const restoreAction = voiceSessionRestoreAction(call, user?.id ?? "");
          if (restoreAction === "incoming") {
            if (!cancelled && shouldInterruptIncomingCall(call)) {
              setIncomingCall(call);
            }
            return;
          }
          if (restoreAction === "release") {
            await voiceApi.leaveSession().catch(() => undefined);
            return;
          }
        }
        const resumed = await voiceApi.resumeSession();
        if (cancelled) return;
        if (call) setActiveCall(call);
        await connect(session, resumed.credentials, { camera: false });
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [connect, disconnectRoom, status, user?.id]);

  useEffect(() => {
    const subscription = AppState.addEventListener("change", (next) => {
      if (shouldStopCameraForAppState(next, cameraEnabled)) {
        void room.localParticipant
          .setCameraEnabled(false)
          .then(() => setCameraEnabled(false))
          .catch((caught: unknown) =>
            reportError(caught, "The camera could not be stopped"),
          );
      }
    });
    return () => subscription.remove();
  }, [cameraEnabled, reportError, room.localParticipant]);

  useEffect(
    () => () => {
      void room.disconnect();
      void AudioSession.stopAudioSession();
      void voiceForegroundService.stop();
    },
    [room],
  );

  const value: VoiceContextValue = {
    activeCall,
    activeSession,
    audioOutputs,
    cameraEnabled,
    connectionState,
    deafened,
    error,
    incomingCall,
    muted,
    participantsVersion,
    screenShareEnabled,
    selectedAudioOutput,
    acceptCall,
    acceptIncoming,
    cancelCall,
    declineCall,
    declineIncoming,
    disconnectParticipant,
    endCall,
    handleCallPush,
    joinChannel,
    leave,
    muteParticipant,
    openActiveSession,
    room,
    selectAudioOutput,
    startCall,
    stopParticipantScreenShare,
    toggleCamera,
    toggleDeafen,
    toggleMicrophone,
    toggleScreenShare,
  };

  return (
    <RoomContext.Provider value={room}>
      <VoiceContext.Provider value={value}>{children}</VoiceContext.Provider>
    </RoomContext.Provider>
  );
};

export const useVoice = () => {
  const value = useContext(VoiceContext);
  if (!value) throw new Error("VoiceProvider is missing");
  return value;
};
