import { Modal, Pressable, StyleSheet, Text, View } from "react-native";

import { useAppearance } from "@/features/appearance/appearance-provider";

const QUICK_REACTIONS = [
  "\u{1F44D}",
  "\u2764\uFE0F",
  "\u{1F602}",
  "\u{1F62E}",
  "\u{1F622}",
  "\u{1F389}",
] as const;

export const MessageActionSheet = ({
  currentReaction,
  isOwnMessage,
  onClose,
  onDelete,
  onEdit,
  onReact,
  onReply,
  pending,
  visible,
}: {
  currentReaction: string | null;
  isOwnMessage: boolean;
  onClose: () => void;
  onDelete: () => void;
  onEdit: () => void;
  onReact: (emoji: string) => void | Promise<void>;
  onReply?: () => void;
  pending: boolean;
  visible: boolean;
}) => {
  const { theme } = useAppearance();

  return (
    <Modal
      animationType="slide"
      onRequestClose={onClose}
      transparent
      visible={visible}
    >
      <Pressable
        accessibilityLabel="Close message actions"
        onPress={onClose}
        style={styles.backdrop}
      >
        <Pressable
          accessibilityViewIsModal
          onPress={(event) => event.stopPropagation()}
          style={[
            styles.sheet,
            { backgroundColor: theme.panel, borderColor: theme.border },
          ]}
        >
          <View style={styles.handle} />
          <Text style={[styles.title, { color: theme.text }]}>React</Text>
          <View style={styles.reactionRow}>
            {QUICK_REACTIONS.map((emoji) => {
              const selected = currentReaction === emoji;
              return (
                <Pressable
                  accessibilityLabel={`${selected ? "Remove" : "React with"} ${emoji}`}
                  accessibilityRole="button"
                  accessibilityState={{ disabled: pending, selected }}
                  disabled={pending}
                  key={emoji}
                  onPress={() => void onReact(emoji)}
                  style={({ pressed }) => [
                    styles.reaction,
                    {
                      backgroundColor: selected
                        ? theme.accentSoft
                        : theme.panelStrong,
                      borderColor: selected ? theme.accent : theme.border,
                    },
                    pressed && styles.pressed,
                  ]}
                >
                  <Text style={styles.emoji}>{emoji}</Text>
                </Pressable>
              );
            })}
          </View>

          {onReply ? (
            <View style={[styles.actions, { borderTopColor: theme.border }]}>
              <Pressable
                accessibilityRole="button"
                disabled={pending}
                onPress={onReply}
                style={({ pressed }) => [
                  styles.action,
                  pressed && styles.pressed,
                ]}
              >
                <Text style={[styles.actionText, { color: theme.text }]}>
                  Reply
                </Text>
              </Pressable>
            </View>
          ) : null}

          {isOwnMessage ? (
            <View style={[styles.actions, { borderTopColor: theme.border }]}>
              <Pressable
                accessibilityRole="button"
                disabled={pending}
                onPress={onEdit}
                style={({ pressed }) => [
                  styles.action,
                  pressed && styles.pressed,
                ]}
              >
                <Text style={[styles.actionText, { color: theme.text }]}>
                  Edit caption
                </Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                disabled={pending}
                onPress={onDelete}
                style={({ pressed }) => [
                  styles.action,
                  pressed && styles.pressed,
                ]}
              >
                <Text style={[styles.actionText, { color: theme.danger }]}>
                  Delete message
                </Text>
              </Pressable>
            </View>
          ) : null}

          <Pressable
            accessibilityRole="button"
            onPress={onClose}
            style={({ pressed }) => [
              styles.cancel,
              { backgroundColor: theme.panelStrong },
              pressed && styles.pressed,
            ]}
          >
            <Text style={[styles.cancelText, { color: theme.text }]}>
              Cancel
            </Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    backgroundColor: "rgba(2, 7, 18, 0.68)",
    flex: 1,
    justifyContent: "flex-end",
  },
  sheet: {
    borderTopLeftRadius: 26,
    borderTopRightRadius: 26,
    borderWidth: 1,
    gap: 16,
    paddingBottom: 22,
    paddingHorizontal: 18,
    paddingTop: 10,
  },
  handle: {
    alignSelf: "center",
    backgroundColor: "#758196",
    borderRadius: 2,
    height: 4,
    opacity: 0.6,
    width: 42,
  },
  title: { fontSize: 17, fontWeight: "900" },
  reactionRow: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  reaction: {
    alignItems: "center",
    borderRadius: 17,
    borderWidth: 1,
    height: 44,
    justifyContent: "center",
    width: 44,
  },
  emoji: { fontSize: 24 },
  actions: { borderTopWidth: 1, gap: 2, paddingTop: 8 },
  action: { justifyContent: "center", minHeight: 48, paddingHorizontal: 6 },
  actionText: { fontSize: 16, fontWeight: "800" },
  cancel: {
    alignItems: "center",
    borderRadius: 14,
    justifyContent: "center",
    minHeight: 48,
  },
  cancelText: { fontSize: 15, fontWeight: "900" },
  pressed: { opacity: 0.7 },
});
