import { NotificationStatus } from "@intouch/shared/notifications";
import { useQuery } from "@tanstack/react-query";
import * as Notifications from "expo-notifications";
import { router } from "expo-router";
import { Bell } from "lucide-react-native";
import { useEffect } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { useAppearance } from "@/features/appearance/appearance-provider";
import { notificationsApi } from "@/features/notifications/notifications-api";

export const NotificationBell = () => {
  const { theme } = useAppearance();
  const notifications = useQuery({
    queryKey: ["notifications", NotificationStatus.UNREAD],
    queryFn: () => notificationsApi.list(NotificationStatus.UNREAD),
  });
  const count = notifications.data?.unreadCount ?? 0;

  useEffect(() => {
    if (!notifications.data) return;
    void Notifications.setBadgeCountAsync(count).catch(() => false);
  }, [count, notifications.data]);

  return (
    <Pressable
      accessibilityLabel={
        count ? `Open notifications, ${count} unread` : "Open notifications"
      }
      accessibilityRole="button"
      hitSlop={10}
      onPress={() => router.push("/notifications")}
      style={({ pressed }) => [
        styles.button,
        { backgroundColor: theme.panelStrong, borderColor: theme.border },
        pressed && styles.pressed,
      ]}
    >
      <Bell color={theme.text} size={22} />
      {count ? (
        <View style={[styles.badge, { backgroundColor: theme.danger }]}>
          <Text style={styles.badgeText}>{count > 99 ? "99+" : count}</Text>
        </View>
      ) : null}
    </Pressable>
  );
};

const styles = StyleSheet.create({
  button: {
    alignItems: "center",
    borderRadius: 14,
    borderWidth: 1,
    height: 46,
    justifyContent: "center",
    width: 46,
  },
  badge: {
    alignItems: "center",
    borderRadius: 9,
    justifyContent: "center",
    minHeight: 18,
    minWidth: 18,
    paddingHorizontal: 4,
    position: "absolute",
    right: -5,
    top: -5,
  },
  badgeText: { color: "#ffffff", fontSize: 10, fontWeight: "900" },
  pressed: { opacity: 0.72 },
});
