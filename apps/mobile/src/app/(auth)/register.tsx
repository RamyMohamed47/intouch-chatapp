import { zodResolver } from "@hookform/resolvers/zod";
import { registerSchema, type RegisterInput } from "@intouch/shared/auth";
import { Link, router } from "expo-router";
import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { StyleSheet, Text, View } from "react-native";

import { AuthBrand } from "@/components/auth-brand";
import { Button, Card, Field, Heading, Muted } from "@/components/ui/controls";
import { Screen } from "@/components/ui/screen";
import { ApiError } from "@/core/api/client";
import { useAppearance } from "@/features/appearance/appearance-provider";
import { authApi } from "@/features/auth/auth-api";

export default function RegisterScreen() {
  const { theme } = useAppearance();
  const [error, setError] = useState<string | null>(null);
  const { control, handleSubmit, formState } = useForm<RegisterInput>({
    resolver: zodResolver(registerSchema),
    defaultValues: { displayName: "", email: "", password: "", username: "" },
  });
  const submit = handleSubmit(async (input) => {
    try {
      const result = await authApi.register(input);
      router.replace({
        pathname: "/verify-email",
        params: { email: result.email },
      });
    } catch (caught) {
      setError(
        caught instanceof ApiError ? caught.message : "Registration failed",
      );
    }
  });

  return (
    <Screen>
      <View style={styles.hero}>
        <AuthBrand />
        <Heading>Create your account.</Heading>
        <Muted>Your workspace conversations follow you across devices.</Muted>
      </View>
      <Card>
        {(["displayName", "username", "email", "password"] as const).map(
          (name) => (
            <Controller
              control={control}
              key={name}
              name={name}
              render={({ field, fieldState }) => (
                <Field
                  autoCapitalize={name === "displayName" ? "words" : "none"}
                  error={fieldState.error?.message}
                  keyboardType={name === "email" ? "email-address" : "default"}
                  label={
                    name === "displayName"
                      ? "Display name"
                      : name[0]?.toUpperCase() + name.slice(1)
                  }
                  onBlur={field.onBlur}
                  onChangeText={field.onChange}
                  secureTextEntry={name === "password"}
                  value={field.value}
                />
              )}
            />
          ),
        )}
        {error ? <Text style={{ color: theme.danger }}>{error}</Text> : null}
        <Button disabled={formState.isSubmitting} onPress={() => void submit()}>
          {formState.isSubmitting ? "Creating..." : "Create account"}
        </Button>
      </Card>
      <Link href="/login" style={{ color: theme.accent }}>
        Back to sign in
      </Link>
    </Screen>
  );
}

const styles = StyleSheet.create({
  hero: { alignItems: "flex-start", gap: 8, marginTop: 22 },
});
