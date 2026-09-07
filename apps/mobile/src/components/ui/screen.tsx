import { useNetworkState } from "expo-network";
import type { PropsWithChildren, ReactNode } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { useAppearance } from "@/features/appearance/appearance-provider";

interface ScreenProps extends PropsWithChildren {
  refreshing?: boolean;
  onRefresh?: () => void;
  scroll?: boolean;
}

export const Screen = ({
  children,
  onRefresh,
  refreshing = false,
  scroll = true,
}: ScreenProps) => {
  const { theme } = useAppearance();
  const network = useNetworkState();
  const content = scroll ? (
    <ScrollView
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
      refreshControl={
        onRefresh ? (
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        ) : undefined
      }
    >
      {children}
    </ScrollView>
  ) : (
    <View style={styles.fill}>{children}</View>
  );

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: theme.background }]}>
      {network.isConnected === false ? (
        <View style={[styles.offline, { backgroundColor: theme.danger }]}>
          <Text style={styles.offlineText}>
            Offline. Changes are not queued.
          </Text>
        </View>
      ) : null}
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={styles.fill}
      >
        {content}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

export const StateView = ({
  action,
  message,
  title,
  loading = false,
}: {
  action?: ReactNode;
  loading?: boolean;
  message: string;
  title: string;
}) => {
  const { theme } = useAppearance();
  return (
    <View style={styles.state} accessibilityLiveRegion="polite">
      {loading ? <ActivityIndicator color={theme.accent} size="large" /> : null}
      <Text style={[styles.stateTitle, { color: theme.text }]}>{title}</Text>
      <Text style={[styles.stateMessage, { color: theme.muted }]}>
        {message}
      </Text>
      {action}
    </View>
  );
};

const styles = StyleSheet.create({
  safe: { flex: 1 },
  fill: { flex: 1 },
  content: { flexGrow: 1, padding: 20, gap: 16 },
  offline: { paddingHorizontal: 16, paddingVertical: 8 },
  offlineText: { color: "#ffffff", fontSize: 13, textAlign: "center" },
  state: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 28,
    gap: 10,
  },
  stateTitle: { fontSize: 22, fontWeight: "800", textAlign: "center" },
  stateMessage: { fontSize: 15, lineHeight: 22, textAlign: "center" },
});
