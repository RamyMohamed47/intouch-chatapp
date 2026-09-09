import { Redirect, Stack } from "expo-router";

import { StateView } from "@/components/ui/screen";
import { useAuth } from "@/features/auth/auth-provider";

export default function AuthLayout() {
  const { status } = useAuth();
  if (status === "loading") {
    return (
      <StateView loading title="Restoring your session" message="One moment." />
    );
  }
  if (status === "authenticated") return <Redirect href="/workspaces" />;

  return <Stack screenOptions={{ headerShown: false }} />;
}
