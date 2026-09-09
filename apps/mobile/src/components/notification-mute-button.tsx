import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Bell, BellOff } from "lucide-react-native";
import { Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { useState } from "react";

import { Button, Muted } from "@/components/ui/controls";
import { useAppearance } from "@/features/appearance/appearance-provider";
import { notificationsApi } from "@/features/notifications/notifications-api";

type MuteScope =
  | { kind: "organization"; organizationId: string }
  | { kind: "conversation"; conversationId: string };

const PRESETS = [
  { label: "1 hour", milliseconds: 60 * 60 * 1_000 },
  { label: "8 hours", milliseconds: 8 * 60 * 60 * 1_000 },
  { label: "1 day", milliseconds: 24 * 60 * 60 * 1_000 },
  { label: "Until I turn it back on", milliseconds: null },
] as const;

export const NotificationMuteButton = ({ scope }: { scope: MuteScope }) => {
  const { theme } = useAppearance();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const preferences = useQuery({
    queryKey: ["notification-preferences"],
    queryFn: () => notificationsApi.getPreferences(),
  });
  const muted = preferences.data?.mutes.some((mute) =>
    scope.kind === "organization"
      ? mute.organizationId === scope.organizationId && !mute.conversationId
      : mute.conversationId === scope.conversationId,
  );
  const mutation = useMutation({
    mutationFn: async (milliseconds: number | null | "unmute") => {
      if (milliseconds === "unmute") {
        return scope.kind === "organization"
          ? notificationsApi.unmuteOrganization(scope.organizationId)
          : notificationsApi.unmuteConversation(scope.conversationId);
      }
      const mutedUntil =
        milliseconds === null
          ? null
          : new Date(Date.now() + milliseconds).toISOString();
      return scope.kind === "organization"
        ? notificationsApi.muteOrganization(scope.organizationId, {
            mutedUntil,
          })
        : notificationsApi.muteConversation(scope.conversationId, {
            mutedUntil,
          });
    },
    onSuccess: (next) => {
      queryClient.setQueryData(["notification-preferences"], next);
      setOpen(false);
    },
  });

  return (
    <>
      <Pressable
        accessibilityLabel={
          muted ? "Unmute notifications" : "Mute notifications"
        }
        accessibilityRole="button"
        hitSlop={10}
        onPress={() => (muted ? mutation.mutate("unmute") : setOpen(true))}
        style={({ pressed }) => [styles.icon, pressed && styles.pressed]}
      >
        {muted ? (
          <BellOff color={theme.muted} size={22} />
        ) : (
          <Bell color={theme.accent} size={22} />
        )}
      </Pressable>
      <Modal
        animationType="fade"
        onRequestClose={() => setOpen(false)}
        transparent
        visible={open}
      >
        <View style={styles.backdrop}>
          <View
            accessibilityViewIsModal
            style={[
              styles.card,
              { backgroundColor: theme.panel, borderColor: theme.border },
            ]}
          >
            <Text style={[styles.title, { color: theme.text }]}>
              Mute activity
            </Text>
            <Muted>
              Durable inbox records and unread messages remain unchanged.
            </Muted>
            {PRESETS.map((preset) => (
              <Button
                disabled={mutation.isPending}
                key={preset.label}
                onPress={() => mutation.mutate(preset.milliseconds)}
                variant="secondary"
              >
                {preset.label}
              </Button>
            ))}
            <Button onPress={() => setOpen(false)} variant="ghost">
              Cancel
            </Button>
          </View>
        </View>
      </Modal>
    </>
  );
};

const styles = StyleSheet.create({
  icon: {
    alignItems: "center",
    height: 44,
    justifyContent: "center",
    width: 44,
  },
  pressed: { opacity: 0.7 },
  backdrop: {
    backgroundColor: "rgba(2, 7, 18, 0.72)",
    flex: 1,
    justifyContent: "center",
    padding: 24,
  },
  card: { borderRadius: 22, borderWidth: 1, gap: 12, padding: 18 },
  title: { fontSize: 21, fontWeight: "900" },
});
