import { Redirect } from "expo-router";
import { Drawer } from "expo-router/drawer";

import { AppDrawerContent } from "@/components/app-shell";
import { StateView } from "@/components/ui/screen";
import { useAppearance } from "@/features/appearance/appearance-provider";
import { useAuth } from "@/features/auth/auth-provider";

export default function ProtectedLayout() {
  const { status } = useAuth();
  const { theme } = useAppearance();
  if (status === "loading") {
    return (
      <StateView loading title="Restoring your session" message="One moment." />
    );
  }
  if (status !== "authenticated") return <Redirect href="/login" />;

  return (
    <Drawer
      drawerContent={(props) => <AppDrawerContent {...props} />}
      screenOptions={{
        drawerStyle: { backgroundColor: theme.background, width: 304 },
        headerShown: false,
        overlayColor: "rgba(2, 7, 18, 0.68)",
        sceneStyle: { backgroundColor: theme.background },
      }}
    >
      <Drawer.Screen name="(tabs)" options={{ swipeEnabled: true }} />
      <Drawer.Screen
        name="conversation/[conversationId]"
        options={{ swipeEnabled: false }}
      />
      <Drawer.Screen
        name="wallpaper/[conversationId]"
        options={{ swipeEnabled: false }}
      />
      <Drawer.Screen
        name="workspace/[organizationId]"
        options={{ swipeEnabled: false }}
      />
      <Drawer.Screen name="notifications" options={{ swipeEnabled: false }} />
    </Drawer>
  );
}
