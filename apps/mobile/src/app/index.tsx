import { Redirect } from "expo-router";

import { StateView } from "@/components/ui/screen";
import { useAuth } from "@/features/auth/auth-provider";
import { SessionUnreachable } from "@/features/auth/session-unreachable";

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

  if (status === "unreachable") return <SessionUnreachable />;

  return (
    <Redirect href={status === "authenticated" ? "/workspaces" : "/login"} />
  );
}
