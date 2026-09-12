import { MessageCircle, Search, X } from "lucide-react-native";
import { useMemo, useState } from "react";
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import { Button, Muted } from "@/components/ui/controls";
import { useAppearance } from "@/features/appearance/appearance-provider";
import {
  filterEchoConversationOptions,
  type EchoConversationOption,
} from "@/features/ai/echo-conversations";

interface EchoConversationPickerProps {
  allowWorkspace: boolean;
  hasMoreDirectMessages: boolean;
  loadingMoreDirectMessages: boolean;
  onLoadMoreDirectMessages: () => void;
  onSelect: (option: EchoConversationOption | null) => void;
  options: readonly EchoConversationOption[];
  selected: EchoConversationOption | null;
}

export const EchoConversationPicker = ({
  allowWorkspace,
  hasMoreDirectMessages,
  loadingMoreDirectMessages,
  onLoadMoreDirectMessages,
  onSelect,
  options,
  selected,
}: EchoConversationPickerProps) => {
  const { theme } = useAppearance();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const filtered = useMemo(
    () => filterEchoConversationOptions(options, query),
    [options, query],
  );

  const choose = (option: EchoConversationOption | null) => {
    onSelect(option);
    setOpen(false);
    setQuery("");
  };

  return (
    <>
      <Pressable
        accessibilityHint="Opens the Echo conversation picker"
        accessibilityLabel={
          selected
            ? `Echo scope: ${selected.label}`
            : allowWorkspace
              ? "Echo scope: Entire workspace"
              : "Choose an Echo conversation"
        }
        accessibilityRole="button"
        onPress={() => setOpen(true)}
        style={({ pressed }) => [
          styles.trigger,
          { backgroundColor: theme.panel, borderColor: theme.border },
          pressed && styles.pressed,
        ]}
      >
        <MessageCircle color={theme.accent} size={18} />
        <View style={styles.grow}>
          <Muted>CONTEXT</Muted>
          <Text
            numberOfLines={1}
            style={[styles.triggerLabel, { color: theme.text }]}
          >
            {selected?.label ??
              (allowWorkspace ? "Entire workspace" : "Choose conversation")}
          </Text>
        </View>
      </Pressable>
      <Modal
        animationType="slide"
        onRequestClose={() => setOpen(false)}
        transparent
        visible={open}
      >
        <Pressable
          accessibilityLabel="Close Echo conversation picker"
          onPress={() => setOpen(false)}
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
            <View style={styles.headingRow}>
              <View style={styles.grow}>
                <Text style={[styles.title, { color: theme.text }]}>
                  Choose context
                </Text>
                <Muted>Search text channels and direct conversations.</Muted>
              </View>
              <Pressable
                accessibilityLabel="Close picker"
                accessibilityRole="button"
                hitSlop={10}
                onPress={() => setOpen(false)}
              >
                <X color={theme.muted} size={22} />
              </Pressable>
            </View>
            <View
              style={[
                styles.search,
                {
                  backgroundColor: theme.panelStrong,
                  borderColor: theme.border,
                },
              ]}
            >
              <Search color={theme.muted} size={18} />
              <TextInput
                accessibilityLabel="Search Echo conversations"
                autoCapitalize="none"
                autoCorrect={false}
                onChangeText={setQuery}
                placeholder="Search conversations"
                placeholderTextColor={theme.muted}
                style={[styles.searchInput, { color: theme.text }]}
                value={query}
              />
            </View>
            <ScrollView contentContainerStyle={styles.options}>
              {allowWorkspace && !query.trim() ? (
                <PickerOption
                  label="Entire workspace"
                  onPress={() => choose(null)}
                  selected={!selected}
                />
              ) : null}
              {filtered.map((option) => (
                <PickerOption
                  key={option.id}
                  label={option.label}
                  meta={
                    option.type === "CHANNEL"
                      ? "Text channel"
                      : "Direct message"
                  }
                  onPress={() => choose(option)}
                  selected={selected?.id === option.id}
                />
              ))}
              {filtered.length === 0 ? (
                <Muted>No conversations found.</Muted>
              ) : null}
            </ScrollView>
            {hasMoreDirectMessages ? (
              <Button
                disabled={loadingMoreDirectMessages}
                onPress={onLoadMoreDirectMessages}
                variant="secondary"
              >
                {loadingMoreDirectMessages
                  ? "Loading..."
                  : "Load more direct chats"}
              </Button>
            ) : null}
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
};

const PickerOption = ({
  label,
  meta,
  onPress,
  selected,
}: {
  label: string;
  meta?: string;
  onPress: () => void;
  selected: boolean;
}) => {
  const { theme } = useAppearance();
  return (
    <Pressable
      accessibilityLabel={`Use ${label} as Echo context`}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={onPress}
      style={({ pressed }) => [
        styles.option,
        {
          backgroundColor: selected ? theme.accentSoft : theme.panelStrong,
          borderColor: selected ? theme.accent : theme.border,
        },
        pressed && styles.pressed,
      ]}
    >
      <Text style={[styles.optionLabel, { color: theme.text }]}>{label}</Text>
      {meta ? <Muted>{meta}</Muted> : null}
    </Pressable>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    backgroundColor: "rgba(2, 7, 18, 0.72)",
    flex: 1,
    justifyContent: "flex-end",
  },
  grow: { flex: 1, gap: 2 },
  headingRow: { alignItems: "flex-start", flexDirection: "row", gap: 12 },
  option: {
    borderRadius: 15,
    borderWidth: 1,
    gap: 3,
    minHeight: 60,
    padding: 12,
  },
  optionLabel: { fontSize: 16, fontWeight: "800" },
  options: { gap: 9, paddingVertical: 2 },
  pressed: { opacity: 0.76 },
  search: {
    alignItems: "center",
    borderRadius: 15,
    borderWidth: 1,
    flexDirection: "row",
    gap: 9,
    paddingHorizontal: 12,
  },
  searchInput: { flex: 1, minHeight: 48 },
  sheet: {
    borderTopLeftRadius: 26,
    borderTopRightRadius: 26,
    borderWidth: 1,
    gap: 14,
    maxHeight: "82%",
    padding: 18,
  },
  title: { fontSize: 22, fontWeight: "900" },
  trigger: {
    alignItems: "center",
    borderRadius: 16,
    borderWidth: 1,
    flexDirection: "row",
    gap: 10,
    minHeight: 58,
    paddingHorizontal: 13,
    width: "100%",
  },
  triggerLabel: { fontSize: 15, fontWeight: "800" },
});
