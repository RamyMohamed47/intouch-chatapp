import { ChannelKind, ConversationType } from "@intouch/shared/conversations";
import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { router } from "expo-router";
import { Hash, Plus, Volume2 } from "lucide-react-native";
import { useState } from "react";
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { MainScreenHeader } from "@/components/app-shell";
import { Button, Card, Muted } from "@/components/ui/controls";
import { Screen, StateView } from "@/components/ui/screen";
import { UserAvatar } from "@/components/user-avatar";
import { conversationsApi } from "@/features/conversations/conversations-api";
import { useAppearance } from "@/features/appearance/appearance-provider";
import { useAuth } from "@/features/auth/auth-provider";
import { useWorkspace } from "@/features/organizations/workspace-provider";
import { organizationsApi } from "@/features/organizations/organizations-api";

export default function ChatsScreen() {
  const { theme } = useAppearance();
  const { user } = useAuth();
  const { activeOrganizationId } = useWorkspace();
  const queryClient = useQueryClient();
  const [directPickerOpen, setDirectPickerOpen] = useState(false);
  const channels = useQuery({
    queryKey: [
      "organizations",
      activeOrganizationId,
      "conversations",
      "channels",
    ],
    queryFn: () => conversationsApi.channels(activeOrganizationId ?? ""),
    enabled: Boolean(activeOrganizationId),
  });
  const members = useQuery({
    queryKey: ["organizations", activeOrganizationId, "members"],
    queryFn: () => organizationsApi.members(activeOrganizationId ?? ""),
    enabled: Boolean(activeOrganizationId),
  });
  const directs = useInfiniteQuery({
    queryKey: [
      "organizations",
      activeOrganizationId,
      "conversations",
      "directs",
    ],
    queryFn: ({ pageParam }) =>
      conversationsApi.directMessages(activeOrganizationId ?? "", pageParam),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: ({ nextCursor }) => nextCursor ?? undefined,
    enabled: Boolean(activeOrganizationId),
  });
  const startDirectMessage = useMutation({
    mutationFn: (recipientUserId: string) => {
      if (!activeOrganizationId) {
        throw new Error("Choose a workspace before starting a conversation");
      }
      return conversationsApi.createDirectMessage(activeOrganizationId, {
        recipientUserId,
      });
    },
    onSuccess: async (direct) => {
      setDirectPickerOpen(false);
      await queryClient.invalidateQueries({
        queryKey: [
          "organizations",
          activeOrganizationId,
          "conversations",
          "directs",
        ],
      });
      router.push(`/conversation/${direct.id}`);
    },
  });

  if (!activeOrganizationId) {
    return (
      <Screen scroll={false}>
        <View style={styles.emptyHeader}>
          <MainScreenHeader title="Chats" />
        </View>
        <StateView
          title="Choose a workspace"
          message="Open Workspaces to create or select one before chatting."
        />
      </Screen>
    );
  }

  const directMessages =
    directs.data?.pages.flatMap((page) => page.directMessages) ?? [];
  const directCandidates =
    members.data?.filter((member) => member.user.id !== user?.id) ?? [];
  return (
    <Screen
      onRefresh={() =>
        void Promise.all([channels.refetch(), directs.refetch()])
      }
      refreshing={channels.isRefetching || directs.isRefetching}
    >
      <MainScreenHeader
        subtitle={`${directMessages.length} direct chats`}
        title="Chats"
      />

      <Text style={[styles.section, { color: theme.muted }]}>CHANNELS</Text>
      {channels.data?.map((conversation) => (
        <Pressable
          key={conversation.id}
          onPress={() =>
            conversation.type === ConversationType.CHANNEL &&
            conversation.kind === ChannelKind.TEXT
              ? router.push(`/conversation/${conversation.id}`)
              : undefined
          }
        >
          <Card>
            <View style={styles.row}>
              {conversation.type === ConversationType.CHANNEL &&
              conversation.kind === ChannelKind.VOICE ? (
                <Volume2 color={theme.muted} size={22} />
              ) : (
                <Hash color={theme.accent} size={22} />
              )}
              <View style={styles.grow}>
                <Text style={[styles.name, { color: theme.text }]}>
                  {conversation.type === ConversationType.CHANNEL
                    ? conversation.name
                    : "Direct message"}
                </Text>
                <Muted>
                  {conversation.type === ConversationType.CHANNEL &&
                  conversation.kind === ChannelKind.VOICE
                    ? `Voice is available on web - ${conversation.occupancy.participantUserIds.length}/10`
                    : (conversation.lastMessage?.content ??
                      (conversation.lastMessage?.attachments.length
                        ? "Files"
                        : "No messages yet"))}
                </Muted>
              </View>
              {"unreadCount" in conversation &&
              (conversation.unreadCount ?? 0) > 0 ? (
                <View style={[styles.badge, { backgroundColor: theme.accent }]}>
                  <Text style={styles.badgeText}>
                    {conversation.unreadCount}
                  </Text>
                </View>
              ) : null}
            </View>
          </Card>
        </Pressable>
      ))}

      <View style={styles.sectionHeader}>
        <Text style={[styles.section, { color: theme.muted }]}>
          DIRECT MESSAGES
        </Text>
        <Pressable
          accessibilityLabel="Start a direct message"
          accessibilityRole="button"
          onPress={() => {
            startDirectMessage.reset();
            setDirectPickerOpen(true);
          }}
          style={({ pressed }) => [
            styles.newDirect,
            {
              backgroundColor: theme.accentSoft,
              borderColor: theme.border,
            },
            pressed && styles.pressed,
          ]}
        >
          <Plus color={theme.accent} size={18} />
          <Text style={{ color: theme.accent, fontWeight: "800" }}>New</Text>
        </Pressable>
      </View>
      {directMessages.map((conversation) => (
        <Pressable
          key={conversation.id}
          onPress={() => router.push(`/conversation/${conversation.id}`)}
        >
          <Card>
            <View style={styles.row}>
              <UserAvatar
                assetId={conversation.peer.avatarAssetId}
                displayName={conversation.peer.displayName}
                externalUrl={conversation.peer.avatarUrl}
                online={
                  members.data?.find(
                    (member) => member.user.id === conversation.peer.id,
                  )?.user.status === "ONLINE"
                }
              />
              <View style={styles.grow}>
                <Text style={[styles.name, { color: theme.text }]}>
                  {conversation.peer.displayName}
                </Text>
                <Muted>
                  {conversation.lastMessage?.content ??
                    (conversation.lastMessage?.messageType === "CALL"
                      ? "Voice call"
                      : conversation.lastMessage?.attachments.length
                        ? "Files"
                        : "Start the conversation")}
                </Muted>
              </View>
              {conversation.unreadCount > 0 ? (
                <View style={[styles.badge, { backgroundColor: theme.accent }]}>
                  <Text style={styles.badgeText}>
                    {conversation.unreadCount}
                  </Text>
                </View>
              ) : null}
            </View>
          </Card>
        </Pressable>
      ))}
      {directs.hasNextPage ? (
        <Card>
          <Button
            disabled={directs.isFetchingNextPage}
            onPress={() => void directs.fetchNextPage()}
            variant="secondary"
          >
            {directs.isFetchingNextPage ? "Loading..." : "Load older chats"}
          </Button>
        </Card>
      ) : null}
      <Modal
        animationType="slide"
        onRequestClose={() => setDirectPickerOpen(false)}
        transparent
        visible={directPickerOpen}
      >
        <Pressable
          accessibilityLabel="Close direct message picker"
          onPress={() => setDirectPickerOpen(false)}
          style={styles.modalBackdrop}
        >
          <Pressable
            accessibilityViewIsModal
            onPress={(event) => event.stopPropagation()}
            style={[
              styles.pickerSheet,
              { backgroundColor: theme.panel, borderColor: theme.border },
            ]}
          >
            <Text style={[styles.pickerTitle, { color: theme.text }]}>
              Start a conversation
            </Text>
            <Muted>Choose a member from this workspace.</Muted>
            <ScrollView contentContainerStyle={styles.pickerList}>
              {directCandidates.map((member) => (
                <Pressable
                  accessibilityLabel={`Message ${member.user.displayName}`}
                  accessibilityRole="button"
                  disabled={startDirectMessage.isPending}
                  key={member.membershipId}
                  onPress={() => startDirectMessage.mutate(member.user.id)}
                  style={({ pressed }) => [
                    styles.candidate,
                    {
                      backgroundColor: theme.panelStrong,
                      borderColor: theme.border,
                    },
                    pressed && styles.pressed,
                  ]}
                >
                  <UserAvatar
                    assetId={member.user.avatarAssetId}
                    displayName={member.user.displayName}
                    externalUrl={member.user.avatarUrl}
                    online={member.user.status === "ONLINE"}
                  />
                  <View style={styles.grow}>
                    <Text style={[styles.name, { color: theme.text }]}>
                      {member.user.displayName}
                    </Text>
                    <Muted>
                      {startDirectMessage.isPending &&
                      startDirectMessage.variables === member.user.id
                        ? "Opening conversation..."
                        : member.role.toLowerCase()}
                    </Muted>
                  </View>
                </Pressable>
              ))}
            </ScrollView>
            {members.isLoading ? <Muted>Loading members...</Muted> : null}
            {!members.isLoading && directCandidates.length === 0 ? (
              <Muted>No other workspace members are available.</Muted>
            ) : null}
            {startDirectMessage.isError ? (
              <Text
                accessibilityLiveRegion="polite"
                style={{ color: theme.danger }}
              >
                {startDirectMessage.error.message}
              </Text>
            ) : null}
            <Button onPress={() => setDirectPickerOpen(false)} variant="ghost">
              Close
            </Button>
          </Pressable>
        </Pressable>
      </Modal>
    </Screen>
  );
}

const styles = StyleSheet.create({
  emptyHeader: { padding: 20 },
  section: {
    fontFamily: "monospace",
    fontSize: 12,
    letterSpacing: 1.7,
    marginTop: 8,
  },
  sectionHeader: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
  },
  newDirect: {
    alignItems: "center",
    borderRadius: 999,
    borderWidth: 1,
    flexDirection: "row",
    gap: 6,
    minHeight: 40,
    paddingHorizontal: 13,
  },
  row: { flexDirection: "row", alignItems: "center", gap: 13 },
  grow: { flex: 1, gap: 3 },
  name: { fontSize: 16, fontWeight: "800" },
  badge: {
    minWidth: 24,
    height: 24,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  badgeText: { color: "#ffffff", fontSize: 12, fontWeight: "900" },
  modalBackdrop: {
    backgroundColor: "rgba(0, 0, 0, 0.7)",
    flex: 1,
    justifyContent: "flex-end",
  },
  pickerSheet: {
    borderTopLeftRadius: 26,
    borderTopRightRadius: 26,
    borderWidth: 1,
    gap: 12,
    maxHeight: "76%",
    padding: 18,
  },
  pickerTitle: { fontSize: 22, fontWeight: "900" },
  pickerList: { gap: 10, paddingVertical: 4 },
  candidate: {
    alignItems: "center",
    borderRadius: 16,
    borderWidth: 1,
    flexDirection: "row",
    gap: 12,
    minHeight: 68,
    padding: 11,
  },
  pressed: { opacity: 0.75 },
});
