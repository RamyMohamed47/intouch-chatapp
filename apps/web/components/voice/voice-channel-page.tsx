"use client";

import type { VoiceChannelConversationDto } from "@intouch/shared/conversations";
import { ConnectionState } from "livekit-client";
import {
  Headphones,
  HeadphoneOff,
  Mic,
  MicOff,
  PhoneCall,
  PhoneOff,
  Radio,
  Signal,
  UserMinus,
  Volume2,
  VolumeX,
} from "lucide-react";
import { useEffect, useState } from "react";

import { InviteMemberDialog } from "@/components/memberships/invite-member-dialog";
import { UserAvatar } from "@/components/users/user-avatar";
import { SpeakingIndicator } from "@/components/voice/speaking-indicator";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/workspace/page-header";
import { voiceApi } from "@/lib/api/voice";
import { useMembers, useOrganization } from "@/lib/query/hooks";
import { useVoice } from "@/lib/voice/provider";

export function VoiceChannelPage({
  organizationId,
  conversation,
}: {
  organizationId: string;
  conversation: VoiceChannelConversationDto;
}) {
  const organization = useOrganization(organizationId);
  const members = useMembers(organizationId);
  const voice = useVoice();
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [pendingUserId, setPendingUserId] = useState<string | null>(null);
  const [moderationError, setModerationError] = useState<string | null>(null);
  const connectedHere =
    voice.activeSession?.kind === "VOICE_CHANNEL" &&
    voice.activeSession.conversationId === conversation.id;
  const participantIds = connectedHere
    ? voice.participantIdentities.flatMap((identity) => {
        if (identity === voice.activeSession?.id) {
          return voice.activeSession.userId;
        }
        const participant = conversation.occupancy.participants.find(
          ({ participantIdentity }) => participantIdentity === identity,
        );
        return participant ? [participant.userId] : [];
      })
    : conversation.occupancy.participantUserIds;
  const activeSpeakerUserIds = voice.activeSpeakerIdentities.flatMap(
    (identity) => {
      if (identity === voice.activeSession?.id) {
        return voice.activeSession.userId;
      }
      const participant = conversation.occupancy.participants.find(
        ({ participantIdentity }) => participantIdentity === identity,
      );
      return participant ? [participant.userId] : [];
    },
  );

  useEffect(() => {
    if (!connectedHere) return;
    const mediaDevices = navigator.mediaDevices;
    if (!mediaDevices?.enumerateDevices) return;
    void mediaDevices
      .enumerateDevices()
      .then((items) =>
        setDevices(items.filter(({ kind }) => kind === "audioinput")),
      )
      .catch(() => setDevices([]));
  }, [connectedHere]);

  const participantMembers = participantIds.map((userId) => ({
    userId,
    user: members.data?.find((member) => member.user.id === userId)?.user,
  }));
  const owner = organization.data?.currentUserRole === "OWNER";

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <PageHeader
        eyebrow={`${conversation.visibility.toLowerCase()} voice channel`}
        title={conversation.name}
        description={`Live audio in ${organization.data?.name ?? "this workspace"}`}
        actions={
          <>
            {owner && (
              <InviteMemberDialog
                organizationId={organizationId}
                organizationName={organization.data?.name ?? "Organization"}
              />
            )}
            <Badge variant="outline">
              {participantIds.length}/{conversation.occupancy.capacity}
            </Badge>
          </>
        }
      />
      <div className="@container relative min-h-0 flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_15%_15%,color-mix(in_oklch,var(--brand-blue)_18%,transparent),transparent_35%),radial-gradient(circle_at_85%_75%,color-mix(in_oklch,var(--brand-orange)_14%,transparent),transparent_42%)]" />
        <div className="relative flex min-h-full items-center justify-center">
          <div className="grid w-full min-w-0 max-w-6xl gap-5 @min-[60rem]:grid-cols-[minmax(0,1fr)_minmax(18rem,20rem)] @min-[60rem]:gap-6">
            <section className="min-w-0 rounded-[2rem] border border-border bg-card/75 p-5 shadow-2xl backdrop-blur-xl sm:p-6 md:p-8">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-primary">
                    Voice lounge
                  </p>
                  <h2 className="mt-2 text-balance text-2xl font-semibold">
                    {connectedHere
                      ? "You are connected"
                      : "Join the conversation"}
                  </h2>
                </div>
                <span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-primary/10 text-primary sm:size-14">
                  <Radio className="size-6" />
                </span>
              </div>

              <div className="mt-7 grid gap-3 sm:grid-cols-2">
                {participantMembers.map(({ userId, user }) => (
                  <div
                    key={userId}
                    className="flex min-w-0 items-center gap-3 rounded-2xl border border-border bg-background/45 p-4"
                  >
                    <div className="relative shrink-0">
                      <UserAvatar
                        displayName={user?.displayName ?? "Member"}
                        avatarAssetId={user?.avatarAssetId}
                        avatarUrl={user?.avatarUrl}
                      />
                      {activeSpeakerUserIds.includes(userId) && (
                        <SpeakingIndicator
                          className="absolute -right-1 -bottom-1"
                          displayName={user?.displayName ?? "Connected member"}
                        />
                      )}
                    </div>
                    <span className="min-w-0 flex-1 truncate text-sm font-medium">
                      {user?.displayName ?? "Connected member"}
                    </span>
                    {owner &&
                      connectedHere &&
                      userId !== voice.activeSession?.userId && (
                        <div className="flex shrink-0 gap-1">
                          <Button
                            size="icon-sm"
                            variant="ghost"
                            aria-label={`Mute ${user?.displayName ?? "participant"}`}
                            disabled={pendingUserId === userId}
                            onClick={() => {
                              setModerationError(null);
                              setPendingUserId(userId);
                              void voiceApi
                                .muteParticipant(conversation.id, userId)
                                .catch((actionError: unknown) =>
                                  setModerationError(
                                    actionError instanceof Error
                                      ? actionError.message
                                      : "Could not mute the participant",
                                  ),
                                )
                                .finally(() => setPendingUserId(null));
                            }}
                          >
                            <VolumeX />
                          </Button>
                          <Button
                            size="icon-sm"
                            variant="destructive"
                            aria-label={`Disconnect ${user?.displayName ?? "participant"}`}
                            disabled={pendingUserId === userId}
                            onClick={() => {
                              setModerationError(null);
                              setPendingUserId(userId);
                              void voiceApi
                                .disconnectParticipant(conversation.id, userId)
                                .catch((actionError: unknown) =>
                                  setModerationError(
                                    actionError instanceof Error
                                      ? actionError.message
                                      : "Could not disconnect the participant",
                                  ),
                                )
                                .finally(() => setPendingUserId(null));
                            }}
                          >
                            <UserMinus />
                          </Button>
                        </div>
                      )}
                  </div>
                ))}
                {participantMembers.length === 0 && (
                  <div className="rounded-2xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground sm:col-span-2">
                    No one is connected yet. Start the room when you are ready.
                  </div>
                )}
              </div>
            </section>

            <aside className="h-fit min-w-0 overflow-hidden rounded-[2rem] border border-border bg-background/55 p-5 backdrop-blur-xl sm:p-6">
              <div className="flex min-w-0 items-center gap-2 text-sm font-medium">
                <Signal className="shrink-0 text-primary" />
                <span className="min-w-0 truncate">
                  {voice.connectionState === ConnectionState.Connected
                    ? `Connection ${voice.connectionQuality.toLowerCase()}`
                    : connectedHere
                      ? "Connecting"
                      : "Not connected"}
                </span>
              </div>
              {(voice.error || moderationError) && (
                <p
                  className="mt-3 break-words text-sm text-destructive"
                  role="alert"
                >
                  {voice.error ?? moderationError}
                </p>
              )}
              {connectedHere ? (
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
                  <div className="grid min-w-0 grid-cols-2 gap-2">
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
                  </div>
                  {devices.length > 0 && (
                    <label className="grid min-w-0 gap-2 text-xs text-muted-foreground">
                      Microphone
                      <select
                        name="voice-input-device"
                        disabled={voice.isTransitioning}
                        className="block h-9 w-full min-w-0 max-w-full truncate rounded-xl border border-border bg-background px-3 text-sm text-foreground"
                        onChange={(event) =>
                          void voice.setInputDevice(event.target.value)
                        }
                      >
                        {devices.map((device, index) => (
                          <option key={device.deviceId} value={device.deviceId}>
                            {device.label || `Microphone ${index + 1}`}
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
                    <PhoneOff /> <span className="truncate">Leave channel</span>
                  </Button>
                </div>
              ) : (
                <Button
                  className="mt-5 w-full min-w-0"
                  disabled={
                    voice.isTransitioning ||
                    participantIds.length >= conversation.occupancy.capacity
                  }
                  onClick={() => void voice.joinChannel(conversation.id)}
                >
                  <PhoneCall />
                  <span className="truncate">
                    {voice.isTransitioning ? "Joining..." : "Join voice"}
                  </span>
                </Button>
              )}
            </aside>
          </div>
        </div>
      </div>
    </div>
  );
}
