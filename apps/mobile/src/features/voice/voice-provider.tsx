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
import { ConnectionState, Room, RoomEvent } from "livekit-client";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type PropsWithChildren,
} from "react";
import { AppState, Platform } from "react-native";

import { useAuth } from "@/features/auth/auth-provider";
import {
  getForegroundNotificationPreferences,
  shouldShowForegroundCall,
} from "@/features/notifications/foreground-notification-policy";
import { useRealtime } from "@/features/realtime/realtime-provider";
import { voiceApi } from "@/features/voice/voice-api";
import incomingCallTone from "@/assets/audio/intouch-call.wav";
import outgoingRingbackTone from "@/assets/audio/intouch-ringback.wav";
import { voiceForegroundService } from "@/features/voice/voice-foreground-service";
import {
  canPublishScreenShare,
  shouldStopCameraForAppState,
} from "@/features/voice/voice-policy";

registerGlobals();

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

export const VoiceProvider = ({ children }: PropsWithChildren) => {
  const { status, user } = useAuth();
  const realtime = useRealtime();
  const queryClient = useQueryClient();
  const [room] = useState(
    () =>
      new Room({
        adaptiveStream: true,
        dynacast: true,
      }),
  );
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
  const connectingRef = useRef(false);
  const ringtone = useAudioPlayer(incomingCallTone);
  const ringback = useAudioPlayer(outgoingRingbackTone);

  const reportError = useCallback((caught: unknown, fallback: string) => {
    setError(caught instanceof Error ? caught.message : fallback);
  }, []);

  const stopTones = useCallback(() => {
    ringtone.pause();
    ringback.pause();
    void ringtone.seekTo(0);
    void ringback.seekTo(0);
  }, [ringback, ringtone]);

  const disconnectRoom = useCallback(async () => {
    stopTones();
    await room.disconnect();
    await AudioSession.stopAudioSession().catch(() => undefined);
    await voiceForegroundService.stop().catch(() => undefined);
    realtime.setVoiceSessionActive(false);
    setConnectionState("idle");
    setMuted(false);
    setDeafened(false);
    setCameraEnabled(false);
    setScreenShareEnabled(false);
    setAudioOutputs([]);
    setSelectedAudioOutput(null);
  }, [realtime, room, stopTones]);

  const connect = useCallback(
    async (
      session: VoiceSessionDto,
      credentials: VoiceCredentialsDto,
      options: { camera: boolean },
    ) => {
      if (connectingRef.current) return;
      connectingRef.current = true;
      setError(null);
      setActiveSession(session);
      setConnectionState("connecting");
      realtime.setVoiceSessionActive(true);
      try {
        await voiceForegroundService.start();
        await AudioSession.startAudioSession();
        if (room.state !== ConnectionState.Disconnected) {
          await room.disconnect();
        }
        await room.connect(credentials.serverUrl, credentials.token);
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
        setConnectionState("connected");
      } catch (caught) {
        await disconnectRoom();
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
    [disconnectRoom, realtime, room],
  );

  const joinChannel = useCallback(
    async (conversationId: string, replace = false) => {
      const joined = await voiceApi.joinChannel(conversationId, replace);
      setActiveCall(null);
      await connect(joined.session, joined.credentials, { camera: false });
    },
    [connect],
  );

  const startCall = useCallback(
    async (
      conversationId: string,
      mediaMode: CallMediaModeValue,
      replace = false,
    ) => {
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
    },
    [connect],
  );

  const acceptCall = useCallback(
    async (callId: string) => {
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
    await voiceApi.leaveSession().catch(() => undefined);
    await disconnectRoom();
    setActiveSession(null);
    setActiveCall(null);
  }, [disconnectRoom]);

  const endCall = useCallback(async () => {
    if (activeCall && !terminalCall(activeCall)) {
      await voiceApi.endCall(activeCall.id).catch(() => undefined);
    }
    await leave();
  }, [activeCall, leave]);

  const cancelCall = useCallback(async () => {
    if (activeCall?.status === CallStatus.RINGING) {
      await voiceApi.cancelCall(activeCall.id).catch(() => undefined);
    }
    await leave();
  }, [activeCall, leave]);

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
    setError(null);
    try {
      const enabled = !cameraEnabled;
      await room.localParticipant.setCameraEnabled(enabled);
      setCameraEnabled(enabled);
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "The camera could not be changed",
      );
    }
  }, [cameraEnabled, room.localParticipant]);

  const toggleScreenShare = useCallback(async () => {
    if (!canPublishScreenShare(Platform.OS)) {
      setError("Starting screen share is currently available on Android");
      return;
    }
    setError(null);
    try {
      const enabled = !screenShareEnabled;
      await room.localParticipant.setScreenShareEnabled(enabled, {
        audio: false,
      });
      setScreenShareEnabled(enabled);
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Screen sharing could not be changed",
      );
    }
  }, [room.localParticipant, screenShareEnabled]);

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
    const connected = () => setConnectionState("connected");
    const reconnecting = () => setConnectionState("reconnecting");
    room.on(RoomEvent.Connected, connected);
    room.on(RoomEvent.Reconnected, connected);
    room.on(RoomEvent.Reconnecting, reconnecting);
    room.on(RoomEvent.ParticipantConnected, refreshParticipants);
    room.on(RoomEvent.ParticipantDisconnected, refreshParticipants);
    room.on(RoomEvent.TrackPublished, refreshParticipants);
    room.on(RoomEvent.TrackUnpublished, refreshParticipants);
    room.on(RoomEvent.TrackSubscribed, refreshParticipants);
    room.on(RoomEvent.TrackMuted, refreshParticipants);
    room.on(RoomEvent.TrackUnmuted, refreshParticipants);
    room.on(RoomEvent.ActiveSpeakersChanged, refreshParticipants);
    return () => {
      room.off(RoomEvent.Connected, connected);
      room.off(RoomEvent.Reconnected, connected);
      room.off(RoomEvent.Reconnecting, reconnecting);
      room.off(RoomEvent.ParticipantConnected, refreshParticipants);
      room.off(RoomEvent.ParticipantDisconnected, refreshParticipants);
      room.off(RoomEvent.TrackPublished, refreshParticipants);
      room.off(RoomEvent.TrackUnpublished, refreshParticipants);
      room.off(RoomEvent.TrackSubscribed, refreshParticipants);
      room.off(RoomEvent.TrackMuted, refreshParticipants);
      room.off(RoomEvent.TrackUnmuted, refreshParticipants);
      room.off(RoomEvent.ActiveSpeakersChanged, refreshParticipants);
    };
  }, [room]);

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
    return stopTones;
  }, [activeCall, incomingCall, ringback, ringtone, stopTones, user?.id]);

  useEffect(() => {
    if (!activeSession) return;
    const timer = setInterval(
      () => void realtime.heartbeatVoice(activeSession.id),
      30_000,
    );
    void realtime.heartbeatVoice(activeSession.id);
    return () => clearInterval(timer);
  }, [activeSession, realtime]);

  useEffect(
    () =>
      realtime.subscribeVoice((event) => {
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
      realtime,
      room.localParticipant,
      screenShareEnabled,
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
        const resumed = await voiceApi.resumeSession();
        if (cancelled) return;
        setActiveSession(session);
        if (session.kind === VoiceSessionKind.CALL && session.callId) {
          const call = await voiceApi.getCall(session.callId);
          if (!cancelled) setActiveCall(call);
        }
        await connect(session, resumed.credentials, { camera: false });
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [connect, disconnectRoom, status]);

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
