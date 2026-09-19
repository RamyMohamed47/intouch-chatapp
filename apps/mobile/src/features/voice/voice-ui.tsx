import { VideoTrack, useParticipants, useTracks } from "@livekit/react-native";
import { CallMediaMode, VoiceSessionKind } from "@intouch/shared/voice";
import {
  Camera,
  CameraOff,
  Check,
  Headphones,
  HeadphoneOff,
  Maximize2,
  Mic,
  MicOff,
  MonitorUp,
  Phone,
  PhoneOff,
  Square,
  Volume2,
  X,
} from "lucide-react-native";
import { Track } from "livekit-client";
import { useEffect, useState } from "react";
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { usePathname } from "expo-router";

import { Button, Card, Muted } from "@/components/ui/controls";
import { UserAvatar } from "@/components/user-avatar";
import { useAppearance } from "@/features/appearance/appearance-provider";
import {
  audioOutputLabel,
  mergeVoiceParticipantIdentities,
} from "@/features/voice/voice-policy";
import { useVoice } from "@/features/voice/voice-provider";

interface ParticipantLabel {
  avatarAssetId?: string | null;
  avatarUrl?: string | null;
  displayName: string;
  userId: string;
}

interface VoiceStageProps {
  canModerate?: boolean;
  participantLabels: Map<string, ParticipantLabel>;
  title: string;
}

const control = (
  label: string,
  onPress: () => void,
  icon: React.ReactNode,
  danger = false,
) => (
  <Pressable
    accessibilityLabel={label}
    accessibilityRole="button"
    onPress={onPress}
    style={({ pressed }) => [
      styles.control,
      danger && styles.dangerControl,
      pressed && styles.pressed,
    ]}
  >
    {icon}
  </Pressable>
);

export const VoiceStage = ({
  canModerate = false,
  participantLabels,
  title,
}: VoiceStageProps) => {
  const { theme } = useAppearance();
  const voice = useVoice();
  const [audioRouteOpen, setAudioRouteOpen] = useState(false);
  const [fullscreenShareIdentity, setFullscreenShareIdentity] = useState<
    string | null
  >(null);
  const participants = useParticipants({ room: voice.room });
  const liveParticipants = new Map(
    participants.map(
      (participant) => [participant.identity, participant] as const,
    ),
  );
  const participantIdentities = mergeVoiceParticipantIdentities(
    [...liveParticipants.keys()],
    [...participantLabels.keys()],
  );
  const videoTracks = useTracks(
    [Track.Source.Camera, Track.Source.ScreenShare],
    { room: voice.room },
  );
  const screenTracks = videoTracks.flatMap((reference) =>
    reference.source === Track.Source.ScreenShare &&
    !reference.publication.isMuted
      ? [
          {
            identity: reference.participant.identity,
            participant: reference.participant,
            reference,
          },
        ]
      : [],
  );
  const fullscreenShare = screenTracks.find(
    ({ identity }) => identity === fullscreenShareIdentity,
  );
  const cameraTracks = videoTracks.flatMap((reference) =>
    reference.source === Track.Source.Camera && !reference.publication.isMuted
      ? [
          {
            identity: reference.participant.identity,
            participant: reference.participant,
            reference,
          },
        ]
      : [],
  );

  useEffect(() => {
    if (fullscreenShareIdentity && !fullscreenShare) {
      setFullscreenShareIdentity(null);
    }
  }, [fullscreenShare, fullscreenShareIdentity]);

  return (
    <View style={styles.stage}>
      <View style={styles.stageHeading}>
        <View style={styles.grow}>
          <Text style={[styles.title, { color: theme.text }]}>{title}</Text>
          <Muted>
            {voice.connectionState === "reconnecting"
              ? "Reconnecting media..."
              : `${participantIdentities.length} connected`}
          </Muted>
        </View>
        <View style={[styles.liveBadge, { backgroundColor: theme.accentSoft }]}>
          <Volume2 color={theme.accent} size={18} />
          <Text style={{ color: theme.accent, fontWeight: "800" }}>Live</Text>
        </View>
      </View>

      {screenTracks.map(({ identity, participant, reference }) => (
        <Pressable
          accessibilityHint="Opens the shared screen fullscreen"
          accessibilityLabel={`View ${participantLabels.get(identity)?.displayName ?? "participant"}'s screen share fullscreen`}
          accessibilityRole="button"
          key={`screen-${identity}`}
          onPress={() => setFullscreenShareIdentity(identity)}
          style={styles.screenShare}
        >
          <VideoTrack
            objectFit="contain"
            style={styles.video}
            trackRef={reference}
          />
          <View style={styles.maximizeBadge}>
            <Maximize2 color="#ffffff" size={18} />
          </View>
          <View style={styles.videoLabel}>
            <Text style={styles.videoLabelText}>
              {participantLabels.get(identity)?.displayName ?? "Screen share"}
            </Text>
          </View>
          {canModerate &&
          participant !== voice.room.localParticipant &&
          participantLabels.get(identity) ? (
            <Pressable
              accessibilityLabel={`Stop ${participantLabels.get(identity)?.displayName}'s screen share`}
              onPress={(event) => {
                event.stopPropagation();
                const userId = participantLabels.get(identity)?.userId;
                if (userId) void voice.stopParticipantScreenShare(userId);
              }}
              style={[styles.moderationButton, styles.stopShareButton]}
            >
              <Square color="#ffffff" fill="#ffffff" size={14} />
            </Pressable>
          ) : null}
        </Pressable>
      ))}

      <ScrollView contentContainerStyle={styles.participantGrid}>
        {participantIdentities.map((identity) => {
          const participant = liveParticipants.get(identity);
          const camera = cameraTracks.find(
            ({ identity: cameraIdentity }) => cameraIdentity === identity,
          );
          const label = participantLabels.get(identity);
          const isLocal = identity === voice.room.localParticipant.identity;
          return (
            <Card key={identity} style={styles.participantCard}>
              {camera ? (
                <VideoTrack
                  mirror={isLocal}
                  objectFit="cover"
                  style={styles.video}
                  trackRef={camera.reference}
                />
              ) : (
                <View style={styles.avatarWrap}>
                  <UserAvatar
                    assetId={label?.avatarAssetId ?? undefined}
                    displayName={label?.displayName ?? "InTouch member"}
                    externalUrl={label?.avatarUrl ?? undefined}
                    size={72}
                  />
                </View>
              )}
              <View style={styles.participantLabel}>
                <Text style={{ color: theme.text, fontWeight: "800" }}>
                  {label?.displayName ?? (isLocal ? "You" : "Teammate")}
                </Text>
                {participant?.isSpeaking ? (
                  <Volume2 color="#33d17a" size={18} />
                ) : null}
              </View>
              {canModerate && !isLocal && label ? (
                <View style={styles.moderationActions}>
                  <Pressable
                    accessibilityLabel={`Mute ${label.displayName}`}
                    onPress={() => void voice.muteParticipant(label.userId)}
                    style={styles.moderationButton}
                  >
                    <MicOff color="#ffffff" size={16} />
                  </Pressable>
                  <Pressable
                    accessibilityLabel={`Disconnect ${label.displayName}`}
                    onPress={() =>
                      void voice.disconnectParticipant(label.userId)
                    }
                    style={[styles.moderationButton, styles.dangerControl]}
                  >
                    <PhoneOff color="#ffffff" size={16} />
                  </Pressable>
                </View>
              ) : null}
            </Card>
          );
        })}
      </ScrollView>

      {voice.error ? (
        <Text accessibilityLiveRegion="polite" style={{ color: theme.danger }}>
          {voice.error}
        </Text>
      ) : null}
      <View style={styles.controls}>
        {control(
          voice.muted ? "Unmute microphone" : "Mute microphone",
          () => void voice.toggleMicrophone(),
          voice.muted ? (
            <MicOff color="#ffffff" size={23} />
          ) : (
            <Mic color="#ffffff" size={23} />
          ),
        )}
        {control(
          "Choose audio output",
          () => setAudioRouteOpen(true),
          <Volume2 color="#ffffff" size={23} />,
        )}
        {control(
          voice.deafened ? "Listen again" : "Deafen",
          voice.toggleDeafen,
          voice.deafened ? (
            <HeadphoneOff color="#ffffff" size={23} />
          ) : (
            <Headphones color="#ffffff" size={23} />
          ),
        )}
        {control(
          voice.cameraEnabled ? "Turn camera off" : "Turn camera on",
          () => void voice.toggleCamera(),
          voice.cameraEnabled ? (
            <Camera color="#ffffff" size={23} />
          ) : (
            <CameraOff color="#ffffff" size={23} />
          ),
        )}
        {control(
          voice.screenShareEnabled ? "Stop sharing" : "Share screen",
          () => void voice.toggleScreenShare(),
          <MonitorUp color="#ffffff" size={23} />,
        )}
        {control(
          "Leave session",
          () =>
            void (voice.activeSession?.kind === VoiceSessionKind.CALL
              ? voice.endCall()
              : voice.leave()),
          <PhoneOff color="#ffffff" size={23} />,
          true,
        )}
      </View>
      <Modal
        animationType="fade"
        onRequestClose={() => setAudioRouteOpen(false)}
        transparent
        visible={audioRouteOpen}
      >
        <View style={styles.modalBackdrop}>
          <Card style={styles.routeCard}>
            <View style={styles.routeHeading}>
              <Text style={[styles.routeTitle, { color: theme.text }]}>
                Audio output
              </Text>
              <Pressable
                accessibilityLabel="Close audio output picker"
                hitSlop={10}
                onPress={() => setAudioRouteOpen(false)}
              >
                <X color={theme.muted} size={22} />
              </Pressable>
            </View>
            {voice.audioOutputs.length ? (
              voice.audioOutputs.map((output) => (
                <Pressable
                  accessibilityLabel={`Use ${audioOutputLabel(output)}`}
                  accessibilityRole="button"
                  accessibilityState={{
                    selected: voice.selectedAudioOutput === output,
                  }}
                  key={output}
                  onPress={() => {
                    void voice.selectAudioOutput(output);
                    setAudioRouteOpen(false);
                  }}
                  style={styles.routeOption}
                >
                  <Text style={{ color: theme.text, fontWeight: "800" }}>
                    {audioOutputLabel(output)}
                  </Text>
                  {voice.selectedAudioOutput === output ? (
                    <Check color={theme.accent} size={20} />
                  ) : null}
                </Pressable>
              ))
            ) : (
              <Muted>
                No selectable audio outputs are currently available.
              </Muted>
            )}
          </Card>
        </View>
      </Modal>
      <Modal
        animationType="fade"
        onRequestClose={() => setFullscreenShareIdentity(null)}
        visible={Boolean(fullscreenShare)}
      >
        <View style={styles.fullscreenShare}>
          {fullscreenShare ? (
            <VideoTrack
              objectFit="contain"
              style={styles.video}
              trackRef={fullscreenShare.reference}
            />
          ) : null}
          <Pressable
            accessibilityLabel="Close fullscreen screen share"
            onPress={() => setFullscreenShareIdentity(null)}
            style={styles.fullscreenClose}
          >
            <X color="#ffffff" size={25} />
          </Pressable>
        </View>
      </Modal>
    </View>
  );
};

export const VoiceOverlay = () => {
  const { theme } = useAppearance();
  const voice = useVoice();
  const pathname = usePathname();
  const incoming = voice.incomingCall;
  const activeCallLabel =
    voice.activeCall?.mediaMode === CallMediaMode.VIDEO
      ? "Video call"
      : "Voice call";
  const activeSession = voice.activeSession;
  const activeSessionPath = activeSession
    ? activeSession.kind === VoiceSessionKind.CALL && activeSession.callId
      ? `/call/${activeSession.callId}`
      : `/conversation/${activeSession.conversationId}`
    : null;
  const showDock = Boolean(activeSession && pathname !== activeSessionPath);
  return (
    <>
      <Modal animationType="fade" transparent visible={Boolean(incoming)}>
        <View style={styles.modalBackdrop}>
          <Card style={styles.incomingCard}>
            <Phone color={theme.accent} size={32} />
            <Text style={[styles.incomingTitle, { color: theme.text }]}>
              Incoming{" "}
              {incoming?.mediaMode === CallMediaMode.VIDEO ? "video" : "voice"}{" "}
              call
            </Text>
            <Muted>A teammate is calling you in InTouch.</Muted>
            {voice.error ? (
              <Text
                accessibilityLiveRegion="polite"
                style={{ color: theme.danger, textAlign: "center" }}
              >
                {voice.error}
              </Text>
            ) : null}
            <View style={styles.incomingActions}>
              <View style={styles.grow}>
                <Button
                  destructive
                  onPress={() => void voice.declineIncoming()}
                >
                  Decline
                </Button>
              </View>
              <View style={styles.grow}>
                <Button onPress={() => void voice.acceptIncoming()}>
                  Accept
                </Button>
              </View>
            </View>
          </Card>
        </View>
      </Modal>
      {showDock && activeSession ? (
        <Pressable
          accessibilityLabel={`Open active ${activeCallLabel}`}
          accessibilityRole="button"
          onPress={voice.openActiveSession}
          style={[
            styles.dock,
            { backgroundColor: theme.panelStrong, borderColor: theme.accent },
          ]}
        >
          <View style={styles.grow}>
            <Text style={{ color: theme.text, fontWeight: "900" }}>
              {activeSession.kind === VoiceSessionKind.CALL
                ? activeCallLabel
                : "Voice channel"}
            </Text>
            <Muted>
              {voice.connectionState === "connected"
                ? `${voice.room.remoteParticipants.size + 1} connected`
                : voice.connectionState}
            </Muted>
          </View>
          {voice.muted ? (
            <MicOff color={theme.muted} size={20} />
          ) : (
            <Mic color={theme.accent} size={20} />
          )}
          <Pressable
            accessibilityLabel="Leave active session"
            hitSlop={10}
            onPress={(event) => {
              event.stopPropagation();
              void (voice.activeSession?.kind === VoiceSessionKind.CALL
                ? voice.endCall()
                : voice.leave());
            }}
          >
            <PhoneOff color={theme.danger} size={22} />
          </Pressable>
        </Pressable>
      ) : null}
    </>
  );
};

export const directParticipantLabels = (
  voice: ReturnType<typeof useVoice>,
  currentUser: {
    avatarAssetId?: string | null;
    avatarUrl?: string | null;
    id: string;
    displayName: string;
  } | null,
  peer: ParticipantLabel | null,
) => {
  const labels = new Map<string, ParticipantLabel>();
  if (currentUser) {
    labels.set(voice.room.localParticipant.identity, {
      userId: currentUser.id,
      displayName: currentUser.displayName,
      ...(currentUser.avatarAssetId
        ? { avatarAssetId: currentUser.avatarAssetId }
        : {}),
      ...(currentUser.avatarUrl ? { avatarUrl: currentUser.avatarUrl } : {}),
    });
  }
  const remote = [...voice.room.remoteParticipants.keys()][0];
  if (remote && peer) labels.set(remote, peer);
  return labels;
};

const styles = StyleSheet.create({
  stage: { flex: 1, gap: 16, padding: 18 },
  stageHeading: { alignItems: "center", flexDirection: "row", gap: 12 },
  grow: { flex: 1 },
  title: { fontSize: 26, fontWeight: "900" },
  liveBadge: {
    alignItems: "center",
    borderRadius: 999,
    flexDirection: "row",
    gap: 7,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  participantGrid: { flexDirection: "row", flexWrap: "wrap", gap: 12 },
  participantCard: {
    height: 205,
    minWidth: 160,
    overflow: "hidden",
    padding: 0,
  },
  avatarWrap: { alignItems: "center", flex: 1, justifyContent: "center" },
  video: { flex: 1, height: "100%", width: "100%" },
  participantLabel: {
    alignItems: "center",
    bottom: 0,
    flexDirection: "row",
    gap: 8,
    justifyContent: "space-between",
    left: 0,
    padding: 12,
    position: "absolute",
    right: 0,
  },
  moderationActions: {
    flexDirection: "row",
    gap: 7,
    position: "absolute",
    right: 9,
    top: 9,
  },
  moderationButton: {
    alignItems: "center",
    backgroundColor: "rgba(20, 31, 51, 0.88)",
    borderRadius: 18,
    height: 36,
    justifyContent: "center",
    width: 36,
  },
  stopShareButton: { position: "absolute", right: 10, top: 10 },
  screenShare: {
    backgroundColor: "#020817",
    borderRadius: 18,
    height: 260,
    overflow: "hidden",
  },
  videoLabel: {
    backgroundColor: "rgba(0,0,0,0.6)",
    bottom: 10,
    left: 10,
    paddingHorizontal: 10,
    paddingVertical: 6,
    position: "absolute",
  },
  videoLabelText: { color: "#ffffff", fontWeight: "800" },
  maximizeBadge: {
    backgroundColor: "rgba(0,0,0,0.6)",
    borderRadius: 18,
    padding: 8,
    position: "absolute",
    right: 10,
    top: 10,
  },
  controls: {
    alignItems: "center",
    flexDirection: "row",
    gap: 10,
    justifyContent: "center",
  },
  control: {
    alignItems: "center",
    backgroundColor: "#26334a",
    borderRadius: 25,
    height: 50,
    justifyContent: "center",
    width: 50,
  },
  dangerControl: { backgroundColor: "#a9303a" },
  pressed: { opacity: 0.72 },
  modalBackdrop: {
    alignItems: "center",
    backgroundColor: "rgba(1, 6, 16, 0.82)",
    flex: 1,
    justifyContent: "center",
    padding: 24,
  },
  incomingCard: { alignItems: "center", maxWidth: 420, width: "100%" },
  incomingTitle: { fontSize: 24, fontWeight: "900", textAlign: "center" },
  incomingActions: { flexDirection: "row", gap: 12, width: "100%" },
  routeCard: { maxWidth: 420, width: "100%" },
  routeHeading: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
  },
  routeTitle: { fontSize: 22, fontWeight: "900" },
  routeOption: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    minHeight: 50,
    paddingHorizontal: 4,
  },
  fullscreenShare: { backgroundColor: "#000000", flex: 1 },
  fullscreenClose: {
    alignItems: "center",
    backgroundColor: "rgba(0,0,0,0.66)",
    borderRadius: 24,
    height: 48,
    justifyContent: "center",
    position: "absolute",
    right: 18,
    top: 48,
    width: 48,
  },
  dock: {
    alignItems: "center",
    borderRadius: 18,
    borderWidth: 1,
    bottom: 82,
    flexDirection: "row",
    gap: 14,
    left: 18,
    padding: 13,
    position: "absolute",
    right: 18,
  },
});
