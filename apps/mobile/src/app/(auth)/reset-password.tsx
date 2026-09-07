import { resetPasswordSchema } from "@intouch/shared/auth";
import { router, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { Text } from "react-native";

import { Button, Card, Field, Heading, Muted } from "@/components/ui/controls";
import { Screen } from "@/components/ui/screen";
import { ApiError } from "@/core/api/client";
import { useAppearance } from "@/features/appearance/appearance-provider";
import { authApi } from "@/features/auth/auth-api";

export default function ResetPasswordScreen() {
  const { token } = useLocalSearchParams<{ token?: string }>();
  const { theme } = useAppearance();
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const submit = async () => {
    const parsed = resetPasswordSchema.safeParse({ token, password });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Invalid reset request");
      return;
    }
    setPending(true);
    try {
      await authApi.resetPassword(parsed.data);
      router.replace("/login");
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : "Reset failed");
    } finally {
      setPending(false);
    }
  };

  return (
    <Screen>
      <Heading>Choose a new password.</Heading>
      <Muted>The reset link is single-use and expires quickly.</Muted>
      <Card>
        <Field
          label="New password"
          onChangeText={setPassword}
          secureTextEntry
          value={password}
        />
        {error ? <Text style={{ color: theme.danger }}>{error}</Text> : null}
        <Button disabled={pending || !token} onPress={() => void submit()}>
          {pending ? "Updating..." : "Update password"}
        </Button>
      </Card>
    </Screen>
  );
}
