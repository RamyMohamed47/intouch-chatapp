import type { ComponentProps, ReactNode } from "react";
import { ArrowLeft } from "lucide-react-native";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";

import { useAppearance } from "@/features/appearance/appearance-provider";

export const BackButton = ({ onPress }: { onPress: () => void }) => {
  const { theme } = useAppearance();

  return (
    <Pressable
      accessibilityLabel="Go back"
      accessibilityRole="button"
      hitSlop={10}
      onPress={onPress}
      style={({ pressed }) => [
        styles.backButton,
        { backgroundColor: theme.panelStrong, borderColor: theme.border },
        pressed && styles.pressed,
      ]}
    >
      <ArrowLeft color={theme.text} size={22} />
    </Pressable>
  );
};

export const Button = ({
  children,
  destructive = false,
  disabled = false,
  variant = "primary",
  ...props
}: ComponentProps<typeof Pressable> & {
  children: ReactNode;
  destructive?: boolean;
  variant?: "primary" | "secondary" | "ghost";
}) => {
  const { theme } = useAppearance();
  const backgroundColor = destructive
    ? theme.danger
    : variant === "primary"
      ? theme.accent
      : variant === "secondary"
        ? theme.panelStrong
        : "transparent";

  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      style={({ pressed }) => [
        styles.button,
        { backgroundColor, borderColor: theme.border },
        pressed && styles.pressed,
        disabled && styles.disabled,
      ]}
      {...props}
    >
      <Text
        style={[
          styles.buttonText,
          {
            color:
              variant === "primary" || destructive ? "#ffffff" : theme.text,
          },
        ]}
      >
        {children}
      </Text>
    </Pressable>
  );
};

export const Field = ({
  error,
  label,
  ...props
}: ComponentProps<typeof TextInput> & {
  error?: string | undefined;
  label: string;
}) => {
  const { theme } = useAppearance();
  return (
    <View style={styles.fieldWrap}>
      <Text style={[styles.label, { color: theme.muted }]}>{label}</Text>
      <TextInput
        accessibilityLabel={label}
        placeholderTextColor={theme.muted}
        style={[
          styles.input,
          {
            backgroundColor: theme.panel,
            borderColor: error ? theme.danger : theme.border,
            color: theme.text,
          },
          props.multiline && styles.multiline,
        ]}
        {...props}
      />
      {error ? (
        <Text accessibilityLiveRegion="polite" style={{ color: theme.danger }}>
          {error}
        </Text>
      ) : null}
    </View>
  );
};

export const Card = ({
  children,
  style,
  ...props
}: ComponentProps<typeof View>) => {
  const { theme } = useAppearance();
  return (
    <View
      {...props}
      style={[
        styles.card,
        { backgroundColor: theme.panel, borderColor: theme.border },
        style,
      ]}
    >
      {children}
    </View>
  );
};

export const Heading = ({ children }: { children: ReactNode }) => {
  const { theme } = useAppearance();
  return (
    <Text style={[styles.heading, { color: theme.text }]}>{children}</Text>
  );
};

export const Muted = ({ children }: { children: ReactNode }) => {
  const { theme } = useAppearance();
  return <Text style={[styles.muted, { color: theme.muted }]}>{children}</Text>;
};

const styles = StyleSheet.create({
  backButton: {
    alignItems: "center",
    borderRadius: 14,
    borderWidth: 1,
    height: 44,
    justifyContent: "center",
    width: 44,
  },
  button: {
    minHeight: 48,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 18,
    paddingVertical: 12,
  },
  pressed: { opacity: 0.76 },
  disabled: { opacity: 0.45 },
  buttonText: { fontSize: 15, fontWeight: "800" },
  fieldWrap: { gap: 7 },
  label: { fontSize: 12, fontWeight: "700", letterSpacing: 0.8 },
  input: {
    minHeight: 50,
    borderRadius: 14,
    borderWidth: 1,
    paddingHorizontal: 15,
    fontSize: 16,
  },
  multiline: { minHeight: 96, paddingTop: 14, textAlignVertical: "top" },
  card: { borderRadius: 20, borderWidth: 1, padding: 16, gap: 12 },
  heading: { fontSize: 28, fontWeight: "900", letterSpacing: -0.8 },
  muted: { fontSize: 14, lineHeight: 20 },
});
