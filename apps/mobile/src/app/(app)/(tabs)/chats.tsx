import { ChannelKind, ConversationType } from "@intouch/shared/conversations";
import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { router } from "expo-router";
import { Hash, Volume2 } from "lucide-react-native";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { MainScreenHeader } from "@/components/app-shell";
import { Button, Card, Muted } from "@/components/ui/controls";
import { Screen, StateView } from "@/components/ui/screen";
import { UserAvatar } from "@/components/user-avatar";
import { conversationsApi } from "@/features/conversations/conversations-api";
import { useAppearance } from "@/features/appearance/appearance-provider";
import { useWorkspace } from "@/features/organizations/workspace-provider";
import { organizationsApi } from "@/features/organizations/organizations-api";

export default function ChatsScreen() {
  const { theme } = useAppearance();
  const { activeOrganizationId } = useWorkspace();
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

      <Text style={[styles.section, { color: theme.muted }]}>
        DIRECT MESSAGES
      </Text>
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
});
