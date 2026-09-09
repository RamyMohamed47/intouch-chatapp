import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useState } from "react";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { ToastProvider } from "@/components/ui/toast-provider";
import { AppearanceProvider } from "@/features/appearance/appearance-provider";
import { AuthProvider } from "@/features/auth/auth-provider";
import { WorkspaceProvider } from "@/features/organizations/workspace-provider";
import { RealtimeProvider } from "@/features/realtime/realtime-provider";
import { PushProvider } from "@/features/push/push-provider";

export default function RootLayout() {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: { retry: 2, staleTime: 20_000 },
          mutations: { retry: false },
        },
      }),
  );

  return (
    <SafeAreaProvider>
      <QueryClientProvider client={queryClient}>
        <AppearanceProvider>
          <AuthProvider>
            <WorkspaceProvider>
              <ToastProvider>
                <PushProvider>
                  <RealtimeProvider>
                    <StatusBar style="auto" />
                    <Stack screenOptions={{ headerShown: false }} />
                  </RealtimeProvider>
                </PushProvider>
              </ToastProvider>
            </WorkspaceProvider>
          </AuthProvider>
        </AppearanceProvider>
      </QueryClientProvider>
    </SafeAreaProvider>
  );
}
