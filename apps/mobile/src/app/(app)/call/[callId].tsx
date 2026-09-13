import { ConversationType } from "@intouch/shared/conversations";
import { CallStatus } from "@intouch/shared/voice";
import { useQuery } from "@tanstack/react-query";
import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { StyleSheet, Text, View } from "react-native";

import { BackButton, Button, Card, Muted } from "@/components/ui/controls";
import { Screen, StateView } from "@/components/ui/screen";
import { useAppearance } from "@/features/appearance/appearance-provider";
import { useAuth } from "@/features/auth/auth-provider";
import { conversationsApi } from "@/features/conversations/conversations-api";
import { VoiceStage, directParticipantLabels } from "@/features/voice/voice-ui";
import { voiceApi } from "@/features/voice/voice-api";
import { useVoice } from "@/features/voice/voice-provider";

const elapsed = (startedAt: string) => {
  const seconds = Math.max(
    0,
    Math.floor((Date.now() - new Date(startedAt).getTime()) / 1_000),
  );
  return `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(
    seconds % 60,
  ).padStart(2, "0")}`;
};

export default function CallScreen() {
  const { callId = "" } = useLocalSearchParams<{ callId: string }>();
  const { theme } = useAppearance();
  const { user } = useAuth();
  const voice = useVoice();
  const callQuery = useQuery({
    queryKey: ["calls", callId],
    queryFn: () => voiceApi.getCall(callId),
    enabled: Boolean(callId),
    refetchInterval: (query) =>
      query.state.data?.status === CallStatus.ENDED ? false : 3_000,
  });
  const call =
    voice.activeCall?.id === callId ? voice.activeCall : callQuery.data;
  const conversation = useQuery({
    queryKey: ["conversations", call?.conversationId],
    queryFn: () => conversationsApi.get(call?.conversationId ?? ""),
    enabled: Boolean(call?.conversationId),
  });
  const [timer, setTimer] = useState("00:00");
  const peer =
    conversation.data?.type === ConversationType.DIRECT
      ? conversation.data.peer
      : null;
  const participantLabels = useMemo(
    () =>
      directParticipantLabels(
        voice,
        user ? { id: user.id, displayName: user.displayName } : null,
        peer
          ? {
              userId: peer.id,
              displayName: peer.displayName,
              avatarAssetId: peer.avatarAssetId,
              ...(peer.avatarUrl ? { avatarUrl: peer.avatarUrl } : {}),
            }
          : null,
      ),
    [peer, user, voice, voice.participantsVersion],
  );

  useEffect(() => {
    const origin = call?.answeredAt ?? call?.startedAt;
    if (!origin || call?.status !== CallStatus.ACTIVE) return;
    const update = () => setTimer(elapsed(origin));
    update();
    const interval = setInterval(update, 1_000);
    return () => clearInterval(interval);
  }, [call?.answeredAt, call?.startedAt, call?.status]);

  if (callQuery.isLoading && !call) {
    return (
      <StateView loading title="Opening call" message="Checking its state." />
    );
  }
  if (!call) {
    return (
      <Screen>
        <BackButton onPress={() => router.back()} />
        <StateView
          title="Call unavailable"
          message="This call could not be loaded."
        />
      </Screen>
    );
  }
  const isRecipient = call.recipientUserId === user?.id;
  const isConnected = voice.activeSession?.callId === call.id;

  if (!isConnected) {
    return (
      <Screen>
        <BackButton onPress={() => router.back()} />
        <Card style={styles.callCard}>
          <Text style={[styles.callTitle, { color: theme.text }]}>
            {call.status === CallStatus.RINGING
              ? isRecipient
                ? `Incoming ${call.mediaMode.toLowerCase()} call`
                : "Calling..."
              : "Call ended"}
          </Text>
          <Muted>{peer?.displayName ?? "InTouch teammate"}</Muted>
          {call.status === CallStatus.RINGING && isRecipient ? (
            <View style={styles.actions}>
              <View style={styles.grow}>
                <Button
                  destructive
                  onPress={() => void voice.declineCall(call.id)}
                >
                  Decline
                </Button>
              </View>
              <View style={styles.grow}>
                <Button onPress={() => void voice.acceptCall(call.id)}>
                  Accept
                </Button>
              </View>
            </View>
          ) : null}
          {call.status === CallStatus.ENDED ? (
            <Button
              onPress={() =>
                router.replace(`/conversation/${call.conversationId}`)
              }
            >
              Return to chat
            </Button>
          ) : null}
        </Card>
      </Screen>
    );
  }

  return (
    <Screen scroll={false}>
      <View style={[styles.header, { borderBottomColor: theme.border }]}>
        <BackButton onPress={() => router.back()} />
        <View style={styles.grow}>
          <Text style={[styles.headerTitle, { color: theme.text }]}>
            {peer?.displayName ?? "Direct call"}
          </Text>
          <Muted>
            {call.status === CallStatus.ACTIVE
              ? timer
              : call.status.toLowerCase()}
          </Muted>
        </View>
      </View>
      <VoiceStage participantLabels={participantLabels} title="Direct call" />
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: {
    alignItems: "center",
    borderBottomWidth: 1,
    flexDirection: "row",
    gap: 12,
    padding: 14,
  },
  headerTitle: { fontSize: 18, fontWeight: "900" },
  grow: { flex: 1 },
  callCard: { alignItems: "center", marginTop: 60 },
  callTitle: { fontSize: 27, fontWeight: "900", textAlign: "center" },
  actions: { flexDirection: "row", gap: 12, width: "100%" },
});
