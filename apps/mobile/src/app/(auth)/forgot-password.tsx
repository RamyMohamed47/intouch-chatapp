import { forgotPasswordSchema } from "@intouch/shared/auth";
import { Link } from "expo-router";
import { useState } from "react";
import { Text } from "react-native";

import { Button, Card, Field, Heading, Muted } from "@/components/ui/controls";
import { Screen } from "@/components/ui/screen";
import { ApiError } from "@/core/api/client";
import { useAppearance } from "@/features/appearance/appearance-provider";
import { authApi } from "@/features/auth/auth-api";

export default function ForgotPasswordScreen() {
  const { theme } = useAppearance();
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const submit = async () => {
    const parsed = forgotPasswordSchema.safeParse({
      email,
      deliveryTarget: "MOBILE",
    });
    if (!parsed.success) {
      setMessage(parsed.error.issues[0]?.message ?? "Enter a valid email");
      return;
    }
    setPending(true);
    try {
      await authApi.forgotPassword(parsed.data);
      setMessage("If that account exists, a reset link is on its way.");
    } catch (caught) {
      setMessage(
        caught instanceof ApiError ? caught.message : "Request failed",
      );
    } finally {
      setPending(false);
    }
  };

  return (
    <Screen>
      <Heading>Reset access.</Heading>
      <Muted>We will send a secure link that opens InTouch.</Muted>
      <Card>
        <Field
          autoCapitalize="none"
          keyboardType="email-address"
          label="Email"
          onChangeText={setEmail}
          value={email}
        />
        {message ? <Text style={{ color: theme.muted }}>{message}</Text> : null}
        <Button disabled={pending} onPress={() => void submit()}>
          {pending ? "Sending..." : "Send reset link"}
        </Button>
      </Card>
      <Link href="/login" style={{ color: theme.accent }}>
        Back to sign in
      </Link>
    </Screen>
  );
}
