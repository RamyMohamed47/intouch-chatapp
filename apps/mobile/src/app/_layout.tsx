import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Stack } from "expo-router";
import { useNavigationContainerRef } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useState } from "react";
import { useEffect } from "react";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { ToastProvider } from "@/components/ui/toast-provider";
import { AppearanceProvider } from "@/features/appearance/appearance-provider";
import { AuthProvider } from "@/features/auth/auth-provider";
import { WorkspaceProvider } from "@/features/organizations/workspace-provider";
import { RealtimeProvider } from "@/features/realtime/realtime-provider";
import { PushProvider } from "@/features/push/push-provider";
import { navigationIntegration, Sentry } from "@/core/monitoring/sentry";

function RootLayout() {
  const navigationRef = useNavigationContainerRef();
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: { retry: 2, staleTime: 20_000 },
          mutations: { retry: false },
        },
      }),
  );

  useEffect(() => {
    navigationIntegration.registerNavigationContainer(navigationRef);
  }, [navigationRef]);

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

export default Sentry.wrap(RootLayout);
