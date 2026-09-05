"use client";

import type { DirectConversationDto } from "@intouch/shared/conversations";
import { ConnectionState } from "livekit-client";
import {
  AudioLines,
  Camera,
  CameraOff,
  HeadphoneOff,
  Headphones,
  Mic,
  MicOff,
  PhoneOff,
  Signal,
  Video,
  Volume2,
} from "lucide-react";
import { useEffect, useState } from "react";

import { PresenceIndicator } from "@/components/presence/presence-indicator";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { UserAvatar } from "@/components/users/user-avatar";
import { SpeakingIndicator } from "@/components/voice/speaking-indicator";
import { ParticipantVideo } from "@/components/voice/participant-video";
import { PageHeader } from "@/components/workspace/page-header";
import { useAuth } from "@/lib/auth/provider";
import { useMembers } from "@/lib/query/hooks";
import { cn } from "@/lib/utils";
import { useVoice } from "@/lib/voice/provider";

export function DirectCallPage({
  conversation,
  organizationName,
}: {
  conversation: DirectConversationDto;
  organizationName: string;
}) {
  const { user } = useAuth();
  const members = useMembers(conversation.organizationId);
  const voice = useVoice();
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const session = voice.activeSession;
  const peerPresence = members.data?.find(
    (member) => member.user.id === conversation.peer.id,
  )?.user;
  const localIdentity = session?.id;
  const localSpeaking = Boolean(
    localIdentity && voice.activeSpeakerIdentities.includes(localIdentity),
  );
  const peerSpeaking = voice.activeSpeakerIdentities.some(
    (identity) => identity !== localIdentity,
  );
  const peerConnected = voice.participantIdentities.some(
    (identity) => identity !== localIdentity,
  );
  const localCamera = voice.cameraTracks.find(({ isLocal }) => isLocal);
  const peerCamera = voice.cameraTracks.find(({ isLocal }) => !isLocal);
  const audioInputs = devices.filter(({ kind }) => kind === "audioinput");
  const videoInputs = devices.filter(({ kind }) => kind === "videoinput");
  const isVideoCall = voice.activeCall?.mediaMode === "VIDEO";

  useEffect(() => {
    const mediaDevices = navigator.mediaDevices;
    if (!mediaDevices?.enumerateDevices) return;
    void mediaDevices
      .enumerateDevices()
      .then(setDevices)
      .catch(() => setDevices([]));
  }, []);

  const callStatus =
    voice.activeCall?.status === "RINGING"
      ? voice.activeCall.callerUserId === user?.id
        ? `Calling ${conversation.peer.displayName}`
        : "Incoming call"
      : voice.connectionState !== ConnectionState.Connected
        ? "Connecting call"
        : peerConnected
          ? "Call connected"
          : `Waiting for ${conversation.peer.displayName}`;

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <PageHeader
        eyebrow={`Direct ${isVideoCall ? "video" : "voice"} call`}
        title={conversation.peer.displayName}
        description={`Private audio and video call in ${organizationName}`}
        actions={
          <Badge variant="outline">
            {isVideoCall ? (
              <Video aria-hidden="true" />
            ) : (
              <AudioLines aria-hidden="true" />
            )}
            Live {isVideoCall ? "video" : "voice"} call
          </Badge>
        }
      />
      <div className="@container relative min-h-0 flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_18%_18%,color-mix(in_oklch,var(--brand-blue)_20%,transparent),transparent_38%),radial-gradient(circle_at_82%_78%,color-mix(in_oklch,var(--brand-orange)_16%,transparent),transparent_44%)]" />
        <div className="relative flex min-h-full items-center justify-center">
          <div className="grid w-full min-w-0 max-w-6xl gap-5 @min-[60rem]:grid-cols-[minmax(0,1fr)_minmax(18rem,20rem)] @min-[60rem]:gap-6">
            <section className="min-w-0 rounded-[2rem] border border-border bg-card/75 p-5 shadow-2xl backdrop-blur-xl sm:p-8">
              <div className="text-center">
                <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-primary">
                  One-to-one call
                </p>
                <h2 className="mt-2 text-balance text-2xl font-semibold">
                  {callStatus}
                </h2>
                <p className="mt-2 text-sm text-muted-foreground">
                  {peerConnected
                    ? "Your conversation is live and private."
                    : "The call will connect when your teammate joins."}
                </p>
              </div>

              <div className="mx-auto mt-9 grid max-w-2xl gap-4 sm:grid-cols-2">
                <div className="relative flex aspect-video min-w-0 flex-col items-center justify-center overflow-hidden rounded-[1.75rem] border border-border bg-background/45 text-center">
                  {localCamera ? (
                    <ParticipantVideo
                      displayName={user?.displayName ?? "You"}
                      isLocal
                      track={localCamera.track}
                    />
                  ) : (
                    <UserAvatar
                      className="size-24 text-xl sm:size-28"
                      displayName={user?.displayName ?? "You"}
                      avatarAssetId={user?.avatarAssetId}
                      avatarUrl={user?.avatarUrl}
                    />
                  )}
                  <div className="absolute inset-x-0 bottom-0 flex items-center justify-between gap-2 bg-gradient-to-t from-black/80 to-transparent px-4 pt-8 pb-3 text-white">
                    <span className="min-w-0 truncate text-sm font-medium">
                      {user?.displayName ?? "You"} (You)
                    </span>
                    <span className="flex shrink-0 items-center gap-2">
                      {!localCamera && <CameraOff className="size-4" />}
                      {localSpeaking && (
                        <SpeakingIndicator
                          className="size-7 [&_svg]:size-3.5"
                          displayName={user?.displayName ?? "You"}
                        />
                      )}
                    </span>
                  </div>
                </div>

                <div
                  className={cn(
                    "relative flex aspect-video min-w-0 flex-col items-center justify-center overflow-hidden rounded-[1.75rem] border border-border bg-background/45 text-center transition-opacity",
                    !peerConnected && "opacity-65",
                  )}
                >
                  {peerCamera ? (
                    <ParticipantVideo
                      displayName={conversation.peer.displayName}
                      track={peerCamera.track}
                    />
                  ) : (
                    <UserAvatar
                      className="size-24 text-xl sm:size-28"
                      displayName={conversation.peer.displayName}
                      avatarAssetId={conversation.peer.avatarAssetId}
                      avatarUrl={conversation.peer.avatarUrl}
                    />
                  )}
                  <div className="absolute inset-x-0 bottom-0 flex items-center justify-between gap-2 bg-gradient-to-t from-black/80 to-transparent px-4 pt-8 pb-3 text-white">
                    <span className="min-w-0 truncate text-sm font-medium">
                      {conversation.peer.displayName}
                    </span>
                    <span className="flex shrink-0 items-center gap-2">
                      {!peerCamera && <CameraOff className="size-4" />}
                      {peerSpeaking && (
                        <SpeakingIndicator
                          className="size-7 [&_svg]:size-3.5"
                          displayName={conversation.peer.displayName}
                        />
                      )}
                    </span>
                  </div>
                  {peerPresence && (
                    <PresenceIndicator
                      className="absolute top-3 right-3 rounded-full bg-background/80 px-2 py-1 text-xs backdrop-blur"
                      displayName={peerPresence.displayName}
                      status={peerPresence.status}
                      lastSeenAt={peerPresence.lastSeenAt}
                    />
                  )}
                </div>
              </div>
            </section>

            <aside className="h-fit min-w-0 overflow-hidden rounded-[2rem] border border-border bg-background/55 p-5 backdrop-blur-xl sm:p-6">
              <div className="flex min-w-0 items-center gap-2 text-sm font-medium">
                <Signal className="shrink-0 text-primary" />
                <span className="min-w-0 truncate">
                  {voice.connectionState === ConnectionState.Connected
                    ? `Connection ${voice.connectionQuality.toLowerCase()}`
                    : "Connecting"}
                </span>
              </div>
              {voice.error && (
                <p
                  className="mt-3 break-words text-sm text-destructive"
                  role="alert"
                >
                  {voice.error}
                </p>
              )}
              <div className="mt-5 grid min-w-0 gap-3">
                {voice.isPlaybackBlocked && (
                  <Button
                    className="w-full min-w-0"
                    variant="outline"
                    disabled={voice.isTransitioning}
                    onClick={() => void voice.enablePlayback()}
                  >
                    <Volume2 /> Enable audio
                  </Button>
                )}
                <div className="grid min-w-0 grid-cols-3 gap-2">
                  <Button
                    className="min-w-0"
                    variant="outline"
                    disabled={voice.isTransitioning}
                    onClick={() => void voice.toggleMute()}
                  >
                    {voice.isMuted ? <MicOff /> : <Mic />}
                    <span className="truncate">
                      {voice.isMuted ? "Unmute" : "Mute"}
                    </span>
                  </Button>
                  <Button
                    className="min-w-0"
                    variant="outline"
                    disabled={voice.isTransitioning}
                    onClick={() => voice.toggleDeafen()}
                  >
                    {voice.isDeafened ? <HeadphoneOff /> : <Headphones />}
                    <span className="truncate">
                      {voice.isDeafened ? "Listen" : "Deafen"}
                    </span>
                  </Button>
                  <Button
                    className="min-w-0"
                    variant="outline"
                    disabled={voice.isCameraTransitioning}
                    onClick={() => void voice.toggleCamera()}
                  >
                    {voice.isCameraEnabled ? <CameraOff /> : <Camera />}
                    <span className="truncate">
                      {voice.isCameraEnabled ? "Stop" : "Camera"}
                    </span>
                  </Button>
                </div>
                {audioInputs.length > 0 && (
                  <label className="grid min-w-0 gap-2 text-xs text-muted-foreground">
                    Microphone
                    <select
                      name="direct-call-input-device"
                      disabled={voice.isTransitioning}
                      className="block h-9 w-full min-w-0 max-w-full truncate rounded-xl border border-border bg-background px-3 text-sm text-foreground"
                      onChange={(event) =>
                        void voice.setInputDevice(event.target.value)
                      }
                    >
                      {audioInputs.map((device, index) => (
                        <option key={device.deviceId} value={device.deviceId}>
                          {device.label || `Microphone ${index + 1}`}
                        </option>
                      ))}
                    </select>
                  </label>
                )}
                {videoInputs.length > 0 && (
                  <label className="grid min-w-0 gap-2 text-xs text-muted-foreground">
                    Camera
                    <select
                      name="direct-call-video-device"
                      disabled={voice.isCameraTransitioning}
                      className="block h-9 w-full min-w-0 max-w-full truncate rounded-xl border border-border bg-background px-3 text-sm text-foreground"
                      onChange={(event) =>
                        void voice.setVideoDevice(event.target.value)
                      }
                    >
                      {videoInputs.map((device, index) => (
                        <option key={device.deviceId} value={device.deviceId}>
                          {device.label || `Camera ${index + 1}`}
                        </option>
                      ))}
                    </select>
                  </label>
                )}
                <Button
                  className="w-full min-w-0"
                  variant="destructive"
                  disabled={voice.isTransitioning}
                  onClick={() => void voice.endSession()}
                >
                  <PhoneOff /> <span className="truncate">End call</span>
                </Button>
              </div>
            </aside>
          </div>
        </div>
      </div>
    </div>
  );
}
