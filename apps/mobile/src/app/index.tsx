import { Redirect } from "expo-router";

import { StateView } from "@/components/ui/screen";
import { useAuth } from "@/features/auth/auth-provider";

export default function IndexScreen() {
  const { status } = useAuth();
  if (status === "loading") {
    return (
      <StateView
        loading
        title="Restoring your session"
        message="Checking your secure InTouch session."
      />
    );
  }

  return (
    <Redirect href={status === "authenticated" ? "/workspaces" : "/login"} />
  );
}
