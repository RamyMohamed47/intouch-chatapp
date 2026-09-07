import { zodResolver } from "@hookform/resolvers/zod";
import { loginSchema, type LoginInput } from "@intouch/shared/auth";
import { Link } from "expo-router";
import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { StyleSheet, Text, View } from "react-native";

import { AuthBrand } from "@/components/auth-brand";
import { Button, Card, Field, Heading, Muted } from "@/components/ui/controls";
import { Screen } from "@/components/ui/screen";
import { ApiError } from "@/core/api/client";
import { useAppearance } from "@/features/appearance/appearance-provider";
import { useAuth } from "@/features/auth/auth-provider";

export default function LoginScreen() {
  const { login, loginWithGoogle } = useAuth();
  const { theme } = useAppearance();
  const [error, setError] = useState<string | null>(null);
  const [googlePending, setGooglePending] = useState(false);
  const { control, handleSubmit, formState } = useForm<LoginInput>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "" },
  });

  const submit = handleSubmit(async ({ email, password }) => {
    setError(null);
    try {
      await login(email, password);
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : "Sign in failed");
    }
  });

  const google = async () => {
    setGooglePending(true);
    setError(null);
    try {
      await loginWithGoogle();
    } catch (caught) {
      setError(
        caught instanceof ApiError ? caught.message : "Google sign in failed",
      );
    } finally {
      setGooglePending(false);
    }
  };

  return (
    <Screen>
      <View style={styles.hero}>
        <AuthBrand />
        <Heading>Good to see you.</Heading>
        <Muted>Sign in to continue your conversations.</Muted>
      </View>
      <Card>
        <Controller
          control={control}
          name="email"
          render={({ field, fieldState }) => (
            <Field
              autoCapitalize="none"
              autoComplete="email"
              error={fieldState.error?.message}
              keyboardType="email-address"
              label="Email"
              onBlur={field.onBlur}
              onChangeText={field.onChange}
              value={field.value}
            />
          )}
        />
        <Controller
          control={control}
          name="password"
          render={({ field, fieldState }) => (
            <Field
              autoComplete="current-password"
              error={fieldState.error?.message}
              label="Password"
              onBlur={field.onBlur}
              onChangeText={field.onChange}
              secureTextEntry
              value={field.value}
            />
          )}
        />
        {error ? (
          <Text
            accessibilityLiveRegion="polite"
            style={{ color: theme.danger }}
          >
            {error}
          </Text>
        ) : null}
        <Button disabled={formState.isSubmitting} onPress={() => void submit()}>
          {formState.isSubmitting ? "Signing in..." : "Sign in"}
        </Button>
        <Button
          disabled={googlePending}
          onPress={() => void google()}
          variant="secondary"
        >
          {googlePending ? "Opening Google..." : "Continue with Google"}
        </Button>
      </Card>
      <View style={styles.links}>
        <Link href="/forgot-password" style={{ color: theme.accent }}>
          Forgot password?
        </Link>
        <Link href="/register" style={{ color: theme.accent }}>
          Create an account
        </Link>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  hero: { alignItems: "flex-start", marginTop: 38, gap: 9 },
  links: { flexDirection: "row", justifyContent: "space-between" },
});
