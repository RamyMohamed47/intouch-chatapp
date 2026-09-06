"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { OrganizationMemberDto } from "@intouch/shared/memberships";
import type {
  CallDto,
  CallMediaModeValue,
  VoiceJoinResponse,
  VoiceSessionDto,
} from "@intouch/shared/voice";
import {
  ConnectionQuality,
  ConnectionState,
  type LocalVideoTrack,
  type Participant,
  type RemoteVideoTrack,
  Room,
  RoomEvent,
  Track,
  VideoPresets,
} from "livekit-client";
import { Phone, PhoneOff, Video } from "lucide-react";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useAuth } from "@/lib/auth/provider";
import { voiceApi } from "@/lib/api/voice";
import { queryKeys } from "@/lib/query/keys";
import { useRealtime } from "@/lib/realtime/provider";
import {
  dismissIncomingCallNotification,
  showIncomingCallNotification,
} from "@/lib/voice/call-notifications";

export interface ParticipantCameraTrack {
  identity: string;
  isLocal: boolean;
  source: "camera";
  track: LocalVideoTrack | RemoteVideoTrack;
}

export interface ParticipantScreenShareTrack {
  hasAudio: boolean;
  id: string;
  identity: string;
  isLocal: boolean;
  observedOrder: number;
  source: "screen_share";
  track: LocalVideoTrack | RemoteVideoTrack;
}

interface VoiceContextValue {
  activeCall: CallDto | null;
  activeSession: VoiceSessionDto | null;
  activeSpeakerIdentities: string[];
  connectionQuality: ConnectionQuality;
  connectionState: ConnectionState;
  error: string | null;
  isDeafened: boolean;
  isCameraEnabled: boolean;
  isCameraTransitioning: boolean;
  isMuted: boolean;
  isPlaybackBlocked: boolean;
  canScreenShare: boolean;
  isScreenShareEnabled: boolean;
  isScreenShareTransitioning: boolean;
  isTransitioning: boolean;
  participantIdentities: string[];
  cameraTracks: ParticipantCameraTrack[];
  screenShareTracks: ParticipantScreenShareTrack[];
  acceptCall(callId: string): Promise<void>;
  declineCall(callId: string): Promise<void>;
  enablePlayback(): Promise<void>;
  endSession(): Promise<void>;
  joinChannel(conversationId: string): Promise<void>;
  setInputDevice(deviceId: string): Promise<void>;
  setVideoDevice(deviceId: string): Promise<void>;
  startCall(
    conversationId: string,
    mediaMode?: CallMediaModeValue,
  ): Promise<void>;
  toggleCamera(): Promise<void>;
  toggleDeafen(): void;
  toggleMute(): Promise<void>;
  toggleScreenShare(): Promise<void>;
}

const VoiceContext = createContext<VoiceContextValue | null>(null);

const createLiveKitRoom = () =>
  new Room({ adaptiveStream: true, dynacast: true });

const shouldReplaceSession = (session: VoiceSessionDto | null) =>
  !session ||
  window.confirm(
    "You already have an active media session. Leave it and switch?",
  );

const voiceErrorMessage = (error: unknown, fallback: string) =>
  error instanceof Error && error.message.trim() ? error.message : fallback;

const cameraErrorMessage = (error: unknown, fallback: string) => {
  if (error instanceof DOMException) {
    if (error.name === "NotAllowedError") {
      return "Camera access was denied. Allow camera access in your browser settings and retry.";
    }
    if (error.name === "NotFoundError") {
      return "No camera was found. Connect a camera and retry.";
    }
    if (error.name === "NotReadableError") {
      return "The camera is unavailable or being used by another application.";
    }
  }
  return voiceErrorMessage(error, fallback);
};

const screenShareErrorMessage = (error: unknown) => {
  if (error instanceof DOMException) {
    if (["AbortError", "NotAllowedError"].includes(error.name)) {
      return "Screen sharing was cancelled or denied.";
    }
    if (error.name === "NotReadableError") {
      return "The selected screen cannot be captured. Close other capture tools and retry.";
    }
    if (error.name === "NotSupportedError") {
      return "Screen sharing is not supported by this browser or device.";
    }
  }
  return voiceErrorMessage(
    error,
    "Could not share your screen. Check browser permissions and retry.",
  );
};

export function VoiceProvider({
  children,
  roomFactory = createLiveKitRoom,
}: {
  children: ReactNode;
  roomFactory?: () => Room;
}) {
  const { status, user } = useAuth();
  const realtime = useRealtime();
  const queryClient = useQueryClient();
  const roomRef = useRef<Room | null>(null);
  const audioContainerRef = useRef<HTMLDivElement | null>(null);
  const attachedAudioTracksRef = useRef(new Set<Track>());
  const transitionInFlightRef = useRef(false);
  const cameraTransitionInFlightRef = useRef(false);
  const screenShareTransitionInFlightRef = useRef(false);
  const screenShareOrderRef = useRef(new Map<string, number>());
  const nextScreenShareOrderRef = useRef(0);
  const isDeafenedRef = useRef(false);
  const [activeSession, setActiveSession] = useState<VoiceSessionDto | null>(
    null,
  );
  const [activeCall, setActiveCall] = useState<CallDto | null>(null);
  const [connectionState, setConnectionState] = useState(
    ConnectionState.Disconnected,
  );
  const [connectionQuality, setConnectionQuality] = useState(
    ConnectionQuality.Unknown,
  );
  const [participantIdentities, setParticipantIdentities] = useState<string[]>(
    [],
  );
  const [activeSpeakerIdentities, setActiveSpeakerIdentities] = useState<
    string[]
  >([]);
  const [cameraTracks, setCameraTracks] = useState<ParticipantCameraTrack[]>(
    [],
  );
  const [isCameraEnabled, setIsCameraEnabled] = useState(false);
  const [isCameraTransitioning, setIsCameraTransitioning] = useState(false);
  const [screenShareTracks, setScreenShareTracks] = useState<
    ParticipantScreenShareTrack[]
  >([]);
  const [canScreenShare, setCanScreenShare] = useState(false);
  const [isScreenShareEnabled, setIsScreenShareEnabled] = useState(false);
  const [isScreenShareTransitioning, setIsScreenShareTransitioning] =
    useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [isDeafened, setIsDeafened] = useState(false);
  const [isPlaybackBlocked, setIsPlaybackBlocked] = useState(false);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setCanScreenShare(
      window.isSecureContext &&
        typeof navigator.mediaDevices?.getDisplayMedia === "function",
    );
  }, []);

  const runTransition = useCallback(
    async (work: () => Promise<void>, fallback: string) => {
      if (transitionInFlightRef.current) return;
      transitionInFlightRef.current = true;
      setIsTransitioning(true);
      setError(null);
      try {
        await work();
      } catch (actionError) {
        setError(voiceErrorMessage(actionError, fallback));
      } finally {
        transitionInFlightRef.current = false;
        setIsTransitioning(false);
      }
    },
    [],
  );

  const activeSessionQuery = useQuery({
    queryKey: queryKeys.voice.activeSession,
    queryFn: () => voiceApi.activeSession(),
    enabled: status === "authenticated",
  });

  const resolveDisplayName = useCallback(
    (userId: string) => {
      for (const [, members] of queryClient.getQueriesData<
        OrganizationMemberDto[]
      >({
        predicate: ({ queryKey }) =>
          queryKey.length === 3 &&
          queryKey[0] === "organizations" &&
          queryKey[2] === "members",
      })) {
        const member = members?.find(({ user }) => user.id === userId);
        if (member) return member.user.displayName;
      }
      return "A teammate";
    },
    [queryClient],
  );

  const syncParticipants = useCallback((room: Room) => {
    setParticipantIdentities([
      room.localParticipant.identity,
      ...room.remoteParticipants.keys(),
    ]);
  }, []);

  const syncCameraTracks = useCallback((room: Room) => {
    const next: ParticipantCameraTrack[] = [];
    const localTrack = room.localParticipant.getTrackPublication(
      Track.Source.Camera,
    )?.videoTrack;
    if (localTrack && room.localParticipant.isCameraEnabled) {
      next.push({
        identity: room.localParticipant.identity,
        isLocal: true,
        source: "camera",
        track: localTrack,
      });
    }
    room.remoteParticipants.forEach((participant) => {
      const publication = participant.getTrackPublication(Track.Source.Camera);
      const track = publication?.videoTrack;
      if (track && !publication.isMuted) {
        next.push({
          identity: participant.identity,
          isLocal: false,
          source: "camera",
          track,
        });
      }
    });
    setCameraTracks((current) => {
      const unchanged =
        current.length === next.length &&
        current.every(
          (entry, index) =>
            entry.identity === next[index]?.identity &&
            entry.track === next[index]?.track,
        );
      return unchanged ? current : next;
    });
    setIsCameraEnabled(room.localParticipant.isCameraEnabled);
  }, []);

  const syncScreenShareTracks = useCallback((room: Room) => {
    const next: ParticipantScreenShareTrack[] = [];
    const appendTrack = (
      identity: string,
      isLocal: boolean,
      participant: Participant,
    ) => {
      const publication = participant.getTrackPublication(
        Track.Source.ScreenShare,
      );
      const track = publication?.videoTrack;
      if (!publication || !track || publication.isMuted) return;
      const id = publication.trackSid;
      let observedOrder = screenShareOrderRef.current.get(id);
      if (observedOrder === undefined) {
        nextScreenShareOrderRef.current += 1;
        observedOrder = nextScreenShareOrderRef.current;
        screenShareOrderRef.current.set(id, observedOrder);
      }
      const audioPublication = participant.getTrackPublication(
        Track.Source.ScreenShareAudio,
      );
      next.push({
        hasAudio: Boolean(audioPublication && !audioPublication.isMuted),
        id,
        identity,
        isLocal,
        observedOrder,
        source: "screen_share",
        track,
      });
    };

    appendTrack(room.localParticipant.identity, true, room.localParticipant);
    room.remoteParticipants.forEach((participant) => {
      appendTrack(participant.identity, false, participant);
    });
    next.sort((left, right) => left.observedOrder - right.observedOrder);
    const activeIds = new Set(next.map(({ id }) => id));
    for (const id of screenShareOrderRef.current.keys()) {
      if (!activeIds.has(id)) screenShareOrderRef.current.delete(id);
    }
    setScreenShareTracks((current) => {
      const unchanged =
        current.length === next.length &&
        current.every(
          (entry, index) =>
            entry.id === next[index]?.id &&
            entry.track === next[index]?.track &&
            entry.hasAudio === next[index]?.hasAudio,
        );
      return unchanged ? current : next;
    });
    const localPublication = room.localParticipant.getTrackPublication(
      Track.Source.ScreenShare,
    );
    setIsScreenShareEnabled(
      Boolean(localPublication?.videoTrack && !localPublication.isMuted),
    );
  }, []);

  const stopLocalScreenShare = useCallback(
    async (room: Room) => {
      if (screenShareTransitionInFlightRef.current) return;
      screenShareTransitionInFlightRef.current = true;
      setIsScreenShareTransitioning(true);
      try {
        await room.localParticipant.setScreenShareEnabled(false);
      } finally {
        syncScreenShareTracks(room);
        screenShareTransitionInFlightRef.current = false;
        setIsScreenShareTransitioning(false);
      }
    },
    [syncScreenShareTracks],
  );

  const disconnectRoom = useCallback(async () => {
    const room = roomRef.current;
    roomRef.current = null;
    attachedAudioTracksRef.current.forEach((track) => {
      track.detach().forEach((element) => element.remove());
    });
    attachedAudioTracksRef.current.clear();
    audioContainerRef.current?.replaceChildren();
    setConnectionState(ConnectionState.Disconnected);
    setConnectionQuality(ConnectionQuality.Unknown);
    setParticipantIdentities([]);
    setActiveSpeakerIdentities([]);
    setCameraTracks([]);
    setScreenShareTracks([]);
    screenShareOrderRef.current.clear();
    nextScreenShareOrderRef.current = 0;
    setIsCameraEnabled(false);
    setIsCameraTransitioning(false);
    cameraTransitionInFlightRef.current = false;
    setIsScreenShareEnabled(false);
    setIsScreenShareTransitioning(false);
    screenShareTransitionInFlightRef.current = false;
    setIsMuted(false);
    setIsDeafened(false);
    isDeafenedRef.current = false;
    setIsPlaybackBlocked(false);
    if (room) {
      try {
        if (room.localParticipant.isScreenShareEnabled) {
          await room.localParticipant.setScreenShareEnabled(false);
        }
      } catch {
        // Disconnecting the room still stops every local media track.
      } finally {
        await room.disconnect();
      }
    }
  }, []);

  const connect = useCallback(
    async (result: VoiceJoinResponse, call?: CallDto, enableCamera = false) => {
      await disconnectRoom();
      setError(null);
      const room = roomFactory();
      roomRef.current = room;
      room.on(RoomEvent.ConnectionStateChanged, setConnectionState);
      room.on(RoomEvent.ParticipantConnected, () => {
        syncParticipants(room);
        syncCameraTracks(room);
        syncScreenShareTracks(room);
      });
      room.on(RoomEvent.ParticipantDisconnected, () => {
        syncParticipants(room);
        syncCameraTracks(room);
        syncScreenShareTracks(room);
      });
      room.on(RoomEvent.ActiveSpeakersChanged, (speakers) =>
        setActiveSpeakerIdentities(speakers.map(({ identity }) => identity)),
      );
      room.on(RoomEvent.ConnectionQualityChanged, (quality, participant) => {
        if (participant.isLocal) setConnectionQuality(quality);
      });
      room.on(RoomEvent.TrackSubscribed, (track, publication) => {
        if (track.kind === Track.Kind.Audio) {
          if (isDeafenedRef.current) publication.setEnabled(false);
          const element = track.attach();
          element.autoplay = true;
          element.setAttribute("aria-hidden", "true");
          audioContainerRef.current?.appendChild(element);
          attachedAudioTracksRef.current.add(track);
          if (track.source === Track.Source.ScreenShareAudio) {
            syncScreenShareTracks(room);
          }
        } else if (track.source === Track.Source.Camera) {
          syncCameraTracks(room);
        } else if (track.source === Track.Source.ScreenShare) {
          syncScreenShareTracks(room);
        }
      });
      room.on(RoomEvent.TrackUnsubscribed, (track) => {
        if (track.kind === Track.Kind.Audio) {
          track.detach().forEach((element) => element.remove());
          attachedAudioTracksRef.current.delete(track);
          if (track.source === Track.Source.ScreenShareAudio) {
            syncScreenShareTracks(room);
          }
        } else if (track.source === Track.Source.Camera) {
          syncCameraTracks(room);
        } else if (track.source === Track.Source.ScreenShare) {
          syncScreenShareTracks(room);
        }
      });
      room.on(RoomEvent.TrackMuted, (publication, participant) => {
        syncCameraTracks(room);
        syncScreenShareTracks(room);
        if (
          participant.isLocal &&
          publication.source === Track.Source.ScreenShare
        ) {
          void stopLocalScreenShare(room).catch(() => {
            setError(
              "Your screen share was stopped, but browser capture could not be closed.",
            );
          });
        }
      });
      room.on(RoomEvent.TrackUnmuted, () => {
        syncCameraTracks(room);
        syncScreenShareTracks(room);
      });
      room.on(RoomEvent.LocalTrackPublished, () => {
        syncCameraTracks(room);
        syncScreenShareTracks(room);
      });
      room.on(RoomEvent.LocalTrackUnpublished, () => {
        syncCameraTracks(room);
        syncScreenShareTracks(room);
      });
      room.on(RoomEvent.AudioPlaybackStatusChanged, (canPlay) => {
        setIsPlaybackBlocked(!canPlay);
      });
      try {
        await room.connect(
          result.credentials.serverUrl,
          result.credentials.token,
        );
        await room.localParticipant.setMicrophoneEnabled(true);
        if (enableCamera) {
          try {
            await room.localParticipant.setCameraEnabled(true, {
              resolution: VideoPresets.h720.resolution,
            });
          } catch (cameraError) {
            setError(
              cameraErrorMessage(
                cameraError,
                "Camera is unavailable. The call is continuing with audio.",
              ),
            );
          }
        }
        setIsPlaybackBlocked(!room.canPlaybackAudio);
        syncParticipants(room);
        syncCameraTracks(room);
        syncScreenShareTracks(room);
        setActiveSession(result.session);
        setActiveCall(call ?? null);
        queryClient.setQueryData(queryKeys.voice.activeSession, result.session);
      } catch (connectionError) {
        await disconnectRoom();
        setError(
          connectionError instanceof Error
            ? connectionError.message
            : "Could not connect to voice",
        );
        throw connectionError;
      }
    },
    [
      disconnectRoom,
      queryClient,
      roomFactory,
      stopLocalScreenShare,
      syncCameraTracks,
      syncParticipants,
      syncScreenShareTracks,
    ],
  );

  const replaceCurrent = useCallback(async () => {
    if (!activeSession) return true;
    if (!shouldReplaceSession(activeSession)) return false;
    await voiceApi.leave();
    await disconnectRoom();
    setActiveSession(null);
    setActiveCall(null);
    return true;
  }, [activeSession, disconnectRoom]);

  const joinChannel = useCallback(
    async (conversationId: string) => {
      await runTransition(async () => {
        if (!(await replaceCurrent())) return;
        await connect(
          await voiceApi.joinChannel(conversationId, {
            replaceActiveSession: Boolean(activeSession),
          }),
        );
      }, "Could not join the voice channel");
    },
    [activeSession, connect, replaceCurrent, runTransition],
  );

  const startCall = useCallback(
    async (conversationId: string, mediaMode: CallMediaModeValue = "AUDIO") => {
      await runTransition(async () => {
        if (!(await replaceCurrent())) return;
        const result = await voiceApi.startCall(conversationId, {
          replaceActiveSession: Boolean(activeSession),
          mediaMode,
        });
        const session = await voiceApi.activeSession();
        if (!session) throw new Error("Call session is unavailable");
        await connect(
          { session, credentials: result.credentials },
          result.call,
          mediaMode === "VIDEO",
        );
      }, "Could not start the voice call");
    },
    [activeSession, connect, replaceCurrent, runTransition],
  );

  const acceptCall = useCallback(
    async (callId: string) => {
      await runTransition(async () => {
        if (!(await replaceCurrent())) return;
        const result = await voiceApi.accept(callId);
        const session = await voiceApi.activeSession();
        if (!session) throw new Error("Call session is unavailable");
        await connect(
          { session, credentials: result.credentials },
          result.call,
          result.call.mediaMode === "VIDEO",
        );
        realtime.dismissIncomingCall();
      }, "Could not accept the voice call");
    },
    [connect, realtime, replaceCurrent, runTransition],
  );

  const declineCall = useCallback(
    async (callId: string) => {
      await runTransition(async () => {
        await voiceApi.transition(callId, "decline");
        realtime.dismissIncomingCall();
      }, "Could not decline the voice call");
    },
    [realtime, runTransition],
  );

  const endSession = useCallback(async () => {
    await runTransition(async () => {
      if (activeCall && activeCall.status !== "ENDED") {
        const callerCanCancel =
          activeCall.callerUserId === user?.id &&
          ["RINGING", "CONNECTING"].includes(activeCall.status);
        await voiceApi.transition(
          activeCall.id,
          callerCanCancel ? "cancel" : "end",
        );
      } else {
        await voiceApi.leave();
      }
      await disconnectRoom();
      setActiveSession(null);
      setActiveCall(null);
      queryClient.setQueryData(queryKeys.voice.activeSession, null);
    }, "Could not leave the voice session");
  }, [activeCall, disconnectRoom, queryClient, runTransition, user?.id]);

  const toggleMute = useCallback(async () => {
    await runTransition(async () => {
      const participant = roomRef.current?.localParticipant;
      if (!participant) return;
      await participant.setMicrophoneEnabled(isMuted);
      setIsMuted(!isMuted);
    }, "Could not change the microphone state");
  }, [isMuted, runTransition]);

  const toggleCamera = useCallback(async () => {
    if (cameraTransitionInFlightRef.current) return;
    const room = roomRef.current;
    if (!room) return;
    cameraTransitionInFlightRef.current = true;
    setIsCameraTransitioning(true);
    setError(null);
    try {
      await room.localParticipant.setCameraEnabled(
        !room.localParticipant.isCameraEnabled,
        { resolution: VideoPresets.h720.resolution },
      );
      syncCameraTracks(room);
    } catch (cameraError) {
      setError(
        cameraErrorMessage(
          cameraError,
          "Could not change the camera. Check browser permissions and retry.",
        ),
      );
    } finally {
      cameraTransitionInFlightRef.current = false;
      setIsCameraTransitioning(false);
    }
  }, [syncCameraTracks]);

  const toggleScreenShare = useCallback(async () => {
    const room = roomRef.current;
    if (!room || screenShareTransitionInFlightRef.current) return;
    if (room.localParticipant.isScreenShareEnabled) {
      try {
        setError(null);
        await stopLocalScreenShare(room);
      } catch (screenError) {
        setError(screenShareErrorMessage(screenError));
      }
      return;
    }
    if (!canScreenShare) {
      setError("Screen sharing is not supported by this browser or device.");
      return;
    }
    screenShareTransitionInFlightRef.current = true;
    setIsScreenShareTransitioning(true);
    setError(null);
    try {
      await room.localParticipant.setScreenShareEnabled(true, {
        audio: true,
        contentHint: "detail",
        selfBrowserSurface: "exclude",
        surfaceSwitching: "include",
        systemAudio: "include",
      });
      syncScreenShareTracks(room);
    } catch (screenError) {
      setError(screenShareErrorMessage(screenError));
    } finally {
      screenShareTransitionInFlightRef.current = false;
      setIsScreenShareTransitioning(false);
    }
  }, [canScreenShare, stopLocalScreenShare, syncScreenShareTracks]);

  const enablePlayback = useCallback(async () => {
    await runTransition(async () => {
      const room = roomRef.current;
      if (!room) return;
      await room.startAudio();
      if (!room.canPlaybackAudio) {
        throw new Error("Your browser is still blocking call audio");
      }
      setIsPlaybackBlocked(false);
    }, "Could not enable call audio");
  }, [runTransition]);

  const toggleDeafen = useCallback(() => {
    if (transitionInFlightRef.current) return;
    setError(null);
    const next = !isDeafened;
    isDeafenedRef.current = next;
    roomRef.current?.remoteParticipants.forEach((participant) => {
      participant.audioTrackPublications.forEach((publication) =>
        publication.setEnabled(!next),
      );
    });
    setIsDeafened(next);
  }, [isDeafened]);

  const setInputDevice = useCallback(
    async (deviceId: string) => {
      await runTransition(async () => {
        await roomRef.current?.switchActiveDevice("audioinput", deviceId);
      }, "Could not change the microphone");
    },
    [runTransition],
  );

  const setVideoDevice = useCallback(
    async (deviceId: string) => {
      if (cameraTransitionInFlightRef.current) return;
      setError(null);
      setIsCameraTransitioning(true);
      cameraTransitionInFlightRef.current = true;
      try {
        await roomRef.current?.switchActiveDevice("videoinput", deviceId);
        if (roomRef.current) syncCameraTracks(roomRef.current);
      } catch (cameraError) {
        setError(
          cameraErrorMessage(cameraError, "Could not change the camera"),
        );
      } finally {
        cameraTransitionInFlightRef.current = false;
        setIsCameraTransitioning(false);
      }
    },
    [syncCameraTracks],
  );

  useEffect(() => {
    const session = activeSessionQuery.data;
    if (!session || activeSession || status !== "authenticated") return;
    void voiceApi
      .resume()
      .then(async (result) => {
        const call = result.session.callId
          ? await voiceApi.getCall(result.session.callId)
          : undefined;
        await connect(result, call, false);
      })
      .catch(() =>
        queryClient.setQueryData(queryKeys.voice.activeSession, null),
      );
  }, [activeSession, activeSessionQuery.data, connect, queryClient, status]);

  useEffect(() => {
    if (!activeSession) return;
    let stopped = false;
    let attempt = 0;
    let consecutiveFailures = 0;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const heartbeat = () => {
      void realtime.heartbeatVoice(activeSession.id).then((result) => {
        if (stopped) return;
        if (!result.success) {
          consecutiveFailures += 1;
          if (consecutiveFailures >= 3) {
            void disconnectRoom();
            setActiveSession(null);
            setActiveCall(null);
            queryClient.setQueryData(queryKeys.voice.activeSession, null);
            return;
          }
          timer = setTimeout(heartbeat, 3_000);
          return;
        }
        consecutiveFailures = 0;
        attempt += 1;
        timer = setTimeout(heartbeat, attempt < 4 ? 3_000 : 30_000);
      });
    };
    heartbeat();
    return () => {
      stopped = true;
      if (timer) clearTimeout(timer);
    };
  }, [activeSession, disconnectRoom, queryClient, realtime]);

  useEffect(() => {
    const call = realtime.latestCall;
    if (!call) return;
    if (activeCall?.id === call.id) setActiveCall(call);
    if (call.status === "ENDED" && activeCall?.id === call.id) {
      void disconnectRoom();
      setActiveSession(null);
      queryClient.setQueryData(queryKeys.voice.activeSession, null);
    }
  }, [activeCall?.id, disconnectRoom, queryClient, realtime.latestCall]);

  useEffect(() => {
    const request = realtime.screenShareStopRequest;
    const room = roomRef.current;
    if (
      !request ||
      !room ||
      request.sessionId !== activeSession?.id ||
      request.conversationId !== activeSession.conversationId
    ) {
      return;
    }
    void stopLocalScreenShare(room)
      .then(() => setError("Your screen share was stopped by an owner."))
      .catch((screenError: unknown) =>
        setError(screenShareErrorMessage(screenError)),
      );
  }, [
    activeSession?.conversationId,
    activeSession?.id,
    realtime.screenShareStopRequest,
    stopLocalScreenShare,
  ]);

  useEffect(() => {
    const call = realtime.incomingCall;
    if (!call || document.visibilityState === "visible") return;
    void showIncomingCallNotification(
      call,
      resolveDisplayName(call.callerUserId),
    ).catch((notificationError: unknown) => {
      console.error("Incoming call notification could not be shown", {
        cause:
          notificationError instanceof Error
            ? notificationError.message
            : "Unknown notification error",
      });
    });

    const dismissWhenVisible = () => {
      if (document.visibilityState === "visible") {
        void dismissIncomingCallNotification(call.id);
      }
    };
    document.addEventListener("visibilitychange", dismissWhenVisible);
    return () => {
      document.removeEventListener("visibilitychange", dismissWhenVisible);
    };
  }, [realtime.incomingCall, resolveDisplayName]);

  useEffect(() => {
    const call = realtime.latestCall;
    if (call?.status !== "ENDED") return;
    void dismissIncomingCallNotification(call.id);
  }, [realtime.latestCall]);

  useEffect(() => {
    if (!realtime.incomingCall) return;
    let audioContext: AudioContext | null = null;
    const ring = () => {
      try {
        audioContext ??= new AudioContext();
        const oscillator = audioContext.createOscillator();
        const gain = audioContext.createGain();
        oscillator.frequency.value = 660;
        gain.gain.setValueAtTime(0.0001, audioContext.currentTime);
        gain.gain.exponentialRampToValueAtTime(
          0.08,
          audioContext.currentTime + 0.02,
        );
        gain.gain.exponentialRampToValueAtTime(
          0.0001,
          audioContext.currentTime + 0.45,
        );
        oscillator.connect(gain).connect(audioContext.destination);
        oscillator.start();
        oscillator.stop(audioContext.currentTime + 0.5);
      } catch {
        // Browser autoplay policy may block audio until the first interaction.
      }
    };
    ring();
    const timer = setInterval(ring, 1_500);
    return () => {
      clearInterval(timer);
      if (audioContext) void audioContext.close();
    };
  }, [realtime.incomingCall]);

  useEffect(() => {
    if (status === "authenticated") return;
    void disconnectRoom();
    setActiveSession(null);
    setActiveCall(null);
  }, [disconnectRoom, status]);

  useEffect(
    () => () => {
      void disconnectRoom();
    },
    [disconnectRoom],
  );

  const incoming = realtime.incomingCall;
  return (
    <VoiceContext.Provider
      value={{
        activeCall,
        activeSession,
        activeSpeakerIdentities,
        cameraTracks,
        screenShareTracks,
        canScreenShare,
        connectionQuality,
        connectionState,
        error,
        isDeafened,
        isCameraEnabled,
        isCameraTransitioning,
        isMuted,
        isPlaybackBlocked,
        isScreenShareEnabled,
        isScreenShareTransitioning,
        isTransitioning,
        participantIdentities,
        acceptCall,
        declineCall,
        enablePlayback,
        endSession,
        joinChannel,
        setInputDevice,
        setVideoDevice,
        startCall,
        toggleCamera,
        toggleDeafen,
        toggleMute,
        toggleScreenShare,
      }}
    >
      {children}
      <div ref={audioContainerRef} aria-hidden="true" />
      <Dialog
        open={Boolean(incoming)}
        onOpenChange={(open) => {
          if (!open && incoming) void declineCall(incoming.id);
        }}
      >
        <DialogContent showCloseButton={false}>
          <DialogHeader>
            <DialogTitle>
              Incoming {incoming?.mediaMode === "VIDEO" ? "video" : "voice"}{" "}
              call
            </DialogTitle>
            <DialogDescription>
              {incoming
                ? `${resolveDisplayName(incoming.callerUserId)} is calling you.`
                : "A teammate is calling you."}
            </DialogDescription>
            {error && (
              <p className="text-sm text-destructive" role="alert">
                {error}
              </p>
            )}
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="destructive"
              disabled={isTransitioning}
              onClick={() => incoming && void declineCall(incoming.id)}
            >
              <PhoneOff /> Decline
            </Button>
            <Button
              disabled={isTransitioning}
              onClick={() => incoming && void acceptCall(incoming.id)}
            >
              {incoming?.mediaMode === "VIDEO" ? <Video /> : <Phone />} Accept
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </VoiceContext.Provider>
  );
}

export const useVoice = () => {
  const context = useContext(VoiceContext);
  if (!context) throw new Error("useVoice must be used within VoiceProvider");
  return context;
};
