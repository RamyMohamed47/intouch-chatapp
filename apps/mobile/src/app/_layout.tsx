import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Stack } from "expo-router";
import { useNavigationContainerRef } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import { useState } from "react";
import { useEffect } from "react";
import { SafeAreaProvider } from "react-native-safe-area-context";

import "@/features/push/push-background-task";

import { shouldRetryQuery } from "@/core/api/query-retry";
import { ToastProvider } from "@/components/ui/toast-provider";
import { AppearanceProvider } from "@/features/appearance/appearance-provider";
import { AuthProvider } from "@/features/auth/auth-provider";
import { WorkspaceProvider } from "@/features/organizations/workspace-provider";
import { RealtimeProvider } from "@/features/realtime/realtime-provider";
import { PushProvider } from "@/features/push/push-provider";
import { StartupSplash } from "@/features/startup/startup-splash";
import { VoiceOverlay } from "@/features/voice/voice-ui";
import { VoiceProvider } from "@/features/voice/voice-provider";
import { navigationIntegration, Sentry } from "@/core/monitoring/sentry";

void SplashScreen.preventAutoHideAsync().catch(() => undefined);

function RootLayout() {
  const navigationRef = useNavigationContainerRef();
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: { retry: shouldRetryQuery, staleTime: 20_000 },
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
                <RealtimeProvider>
                  <VoiceProvider>
                    <PushProvider>
                      <StatusBar style="auto" />
                      <Stack screenOptions={{ headerShown: false }} />
                      <VoiceOverlay />
                      <StartupSplash />
                    </PushProvider>
                  </VoiceProvider>
                </RealtimeProvider>
              </ToastProvider>
            </WorkspaceProvider>
          </AuthProvider>
        </AppearanceProvider>
      </QueryClientProvider>
    </SafeAreaProvider>
  );
}

export default Sentry.wrap(RootLayout);
