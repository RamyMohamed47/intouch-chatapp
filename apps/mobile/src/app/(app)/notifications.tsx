import {
  NotificationStatus,
  type NotificationDto,
} from "@intouch/shared/notifications";
import {
  useInfiniteQuery,
  useMutation,
  useQueryClient,
} from "@tanstack/react-query";
import * as Notifications from "expo-notifications";
import { router } from "expo-router";
import { BellRing } from "lucide-react-native";
import { FlatList, Pressable, StyleSheet, Text, View } from "react-native";

import { UserAvatar } from "@/components/user-avatar";
import { BackButton, Button, Card, Muted } from "@/components/ui/controls";
import { Screen, StateView } from "@/components/ui/screen";
import { useAppearance } from "@/features/appearance/appearance-provider";
import { notificationsApi } from "@/features/notifications/notifications-api";
import { useWorkspace } from "@/features/organizations/workspace-provider";
import {
  notificationCopy,
  notificationHref,
  relativeNotificationTime,
} from "@/features/notifications/notification-presentation";

const NotificationItem = ({
  notification,
  onPress,
}: {
  notification: NotificationDto;
  onPress: () => void;
}) => {
  const { theme } = useAppearance();
  const copy = notificationCopy(notification);
  const unread = notification.readAt === null;
  return (
    <Pressable accessibilityRole="button" onPress={onPress}>
      <Card>
        <View style={styles.itemRow}>
          <UserAvatar
            assetId={notification.actor.avatarAssetId}
            displayName={notification.actor.displayName}
            externalUrl={notification.actor.avatarUrl}
          />
          <View style={styles.grow}>
            <View style={styles.titleRow}>
              <Text style={[styles.itemTitle, { color: theme.text }]}>
                {copy.title}
              </Text>
              {unread ? (
                <View
                  accessibilityLabel="Unread"
                  style={[styles.unread, { backgroundColor: theme.accent }]}
                />
              ) : null}
            </View>
            <Muted>{copy.description}</Muted>
            <Text style={[styles.time, { color: theme.muted }]}>
              {relativeNotificationTime(notification.lastActivityAt)}
            </Text>
          </View>
        </View>
      </Card>
    </Pressable>
  );
};

export default function NotificationsScreen() {
  const { theme } = useAppearance();
  const { setActiveOrganizationId } = useWorkspace();
  const queryClient = useQueryClient();
  const notifications = useInfiniteQuery({
    queryKey: ["notifications", NotificationStatus.ALL],
    queryFn: ({ pageParam }) =>
      notificationsApi.list(NotificationStatus.ALL, pageParam),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: ({ nextCursor }) => nextCursor ?? undefined,
  });
  const markAll = useMutation({
    mutationFn: () => notificationsApi.markAllRead(),
    onSuccess: async () => {
      await Notifications.setBadgeCountAsync(0).catch(() => false);
      await queryClient.invalidateQueries({ queryKey: ["notifications"] });
    },
  });
  const items =
    notifications.data?.pages.flatMap((page) => page.notifications) ?? [];
  const unreadCount = notifications.data?.pages[0]?.unreadCount ?? 0;

  const open = async (notification: NotificationDto) => {
    if (!notification.readAt) await notificationsApi.markRead(notification.id);
    setActiveOrganizationId(notification.organization.id);
    await Notifications.setBadgeCountAsync(
      Math.max(0, unreadCount - (notification.readAt ? 0 : 1)),
    ).catch(() => false);
    await queryClient.invalidateQueries({ queryKey: ["notifications"] });
    router.push(notificationHref(notification));
  };

  return (
    <Screen scroll={false}>
      <View style={styles.screen}>
        <View style={styles.header}>
          <BackButton onPress={() => router.back()} />
          <View style={styles.grow}>
            <Text style={[styles.heading, { color: theme.text }]}>
              Notifications
            </Text>
            <Text style={[styles.subtitle, { color: theme.muted }]}>
              {unreadCount ? `${unreadCount} unread` : "You are caught up"}
            </Text>
          </View>
          {unreadCount ? (
            <Button
              disabled={markAll.isPending}
              onPress={() => markAll.mutate()}
              variant="ghost"
            >
              Read all
            </Button>
          ) : null}
        </View>
        {notifications.isLoading ? (
          <StateView
            loading
            title="Loading notifications"
            message="Checking recent activity."
          />
        ) : notifications.isError ? (
          <StateView
            title="Notifications unavailable"
            message="Pull to retry when your connection is restored."
            action={
              <Button onPress={() => void notifications.refetch()}>
                Retry
              </Button>
            }
          />
        ) : items.length === 0 ? (
          <StateView
            title="Nothing new"
            message="Invitations, direct messages, and reactions will appear here."
            action={<BellRing color={theme.accent} size={30} />}
          />
        ) : (
          <FlatList
            contentContainerStyle={styles.list}
            data={items}
            keyExtractor={(item) => item.id}
            onEndReached={() => {
              if (
                notifications.hasNextPage &&
                !notifications.isFetchingNextPage
              ) {
                void notifications.fetchNextPage();
              }
            }}
            onEndReachedThreshold={0.35}
            onRefresh={() => void notifications.refetch()}
            refreshing={
              notifications.isRefetching && !notifications.isFetchingNextPage
            }
            renderItem={({ item }) => (
              <NotificationItem
                notification={item}
                onPress={() => void open(item)}
              />
            )}
          />
        )}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, paddingHorizontal: 18, paddingTop: 12 },
  header: {
    alignItems: "center",
    flexDirection: "row",
    gap: 12,
    paddingBottom: 14,
  },
  grow: { flex: 1 },
  heading: { fontSize: 25, fontWeight: "900", letterSpacing: -0.6 },
  subtitle: { fontSize: 13, marginTop: 2 },
  list: { gap: 10, paddingBottom: 28 },
  itemRow: { alignItems: "flex-start", flexDirection: "row", gap: 12 },
  titleRow: { alignItems: "flex-start", flexDirection: "row", gap: 8 },
  itemTitle: { flex: 1, fontSize: 15, fontWeight: "800", lineHeight: 20 },
  unread: { borderRadius: 5, height: 9, marginTop: 5, width: 9 },
  time: { fontFamily: "monospace", fontSize: 11, marginTop: 5 },
});
