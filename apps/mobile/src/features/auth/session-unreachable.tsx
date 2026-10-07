import { Button } from "@/components/ui/controls";
import { StateView } from "@/components/ui/screen";
import { useAuth } from "@/features/auth/auth-provider";

export const SessionUnreachable = () => {
  const { retry } = useAuth();

  return (
    <StateView
      title="Can't reach InTouch"
      message="You're still signed in. Check your connection and try again."
      action={<Button onPress={retry}>Try again</Button>}
    />
  );
};
