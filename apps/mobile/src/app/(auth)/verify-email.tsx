import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import { Text } from "react-native";

import { Button, Card, Heading, Muted } from "@/components/ui/controls";
import { Screen } from "@/components/ui/screen";
import { ApiError } from "@/core/api/client";
import { useAppearance } from "@/features/appearance/appearance-provider";
import { authApi } from "@/features/auth/auth-api";

export default function VerifyEmailScreen() {
  const params = useLocalSearchParams<{ email?: string; token?: string }>();
  const { theme } = useAppearance();
  const [message, setMessage] = useState(
    params.token ? "Confirming your email..." : "Open the link in your email.",
  );

  useEffect(() => {
    if (!params.token) return;
    void authApi
      .verifyEmail({ token: params.token })
      .then(() => setMessage("Email confirmed. You can now sign in."))
      .catch((caught: unknown) =>
        setMessage(
          caught instanceof ApiError ? caught.message : "Confirmation failed",
        ),
      );
  }, [params.token]);

  const resend = async () => {
    if (!params.email) return;
    await authApi.resendVerification({
      email: params.email,
      deliveryTarget: "MOBILE",
    });
    setMessage("A fresh confirmation link was sent.");
  };

  return (
    <Screen>
      <Heading>Check your inbox.</Heading>
      <Muted>Email verification protects every workspace.</Muted>
      <Card>
        <Text style={{ color: theme.text }}>{message}</Text>
        {params.email && !params.token ? (
          <Button onPress={() => void resend()} variant="secondary">
            Resend email
          </Button>
        ) : null}
        <Button onPress={() => router.replace("/login")} variant="primary">
          Return to sign in
        </Button>
      </Card>
    </Screen>
  );
}
