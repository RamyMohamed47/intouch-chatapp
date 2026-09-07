import * as ImagePicker from "expo-image-picker";
import { useQueryClient } from "@tanstack/react-query";
import { router } from "expo-router";
import { useState } from "react";
import { Text, View } from "react-native";

import { MainScreenHeader } from "@/components/app-shell";
import { Button, Card, Muted } from "@/components/ui/controls";
import { Screen } from "@/components/ui/screen";
import { UserAvatar } from "@/components/user-avatar";
import { useAppearance } from "@/features/appearance/appearance-provider";
import { ThemeName, type ThemeNameValue } from "@/features/appearance/theme";
import { useAuth } from "@/features/auth/auth-provider";
import {
  prepareSquareImage,
  uploadFiles,
} from "@/features/uploads/upload-client";
import { uploadsApi } from "@/features/uploads/uploads-api";

export default function ProfileScreen() {
  const { logout, updateUser, user } = useAuth();
  const { name, setTheme, theme } = useAppearance();
  const queryClient = useQueryClient();
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);

  const replaceAvatar = async () => {
    const picked = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsEditing: false,
      quality: 1,
    });
    const asset = picked.assets?.[0];
    if (picked.canceled || !asset?.width || !asset.height) return;
    setUploading(true);
    try {
      const file = await prepareSquareImage(
        asset.uri,
        asset.width,
        asset.height,
      );
      const [uploadId] = await uploadFiles(
        { purpose: "AVATAR", files: [file] },
        (_index, next) => setProgress(next),
      );
      if (uploadId) updateUser(await uploadsApi.setAvatar(uploadId));
      await queryClient.invalidateQueries({ queryKey: ["auth"] });
    } finally {
      setUploading(false);
      setProgress(0);
    }
  };

  return (
    <Screen>
      <MainScreenHeader
        subtitle="Manage your identity and mobile appearance."
        title="Profile"
      />
      <Card>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 14 }}>
          <UserAvatar
            assetId={user?.avatarAssetId}
            displayName={user?.displayName ?? "InTouch member"}
            externalUrl={user?.avatarUrl}
            size={68}
          />
          <View style={{ flex: 1 }}>
            <Text
              style={{ color: theme.text, fontSize: 19, fontWeight: "900" }}
            >
              {user?.displayName}
            </Text>
            <Muted>@{user?.username}</Muted>
          </View>
        </View>
        {uploading ? (
          <Muted>Uploading {Math.round(progress * 100)}%</Muted>
        ) : null}
        <Button
          disabled={uploading}
          onPress={() => void replaceAvatar()}
          variant="secondary"
        >
          Replace profile picture
        </Button>
        {user?.avatarAssetId ? (
          <Button
            onPress={() => void uploadsApi.removeAvatar().then(updateUser)}
            variant="ghost"
          >
            Remove custom picture
          </Button>
        ) : null}
      </Card>

      <Text
        style={{
          color: theme.muted,
          fontFamily: "monospace",
          letterSpacing: 1.5,
        }}
      >
        APPEARANCE
      </Text>
      <Card>
        {(Object.values(ThemeName) as ThemeNameValue[]).map((option) => (
          <Button
            key={option}
            onPress={() => setTheme(option)}
            variant={name === option ? "primary" : "secondary"}
          >
            {option[0] + option.slice(1).toLowerCase()}
          </Button>
        ))}
        <Button
          onPress={() => router.push("/wallpaper/default")}
          variant="secondary"
        >
          Default chat wallpaper
        </Button>
      </Card>

      <Card>
        <Muted>
          Voice, video, screen sharing, Echo, search, and push notifications
          remain available on web or in a later mobile release.
        </Muted>
        <Button destructive onPress={() => void logout()}>
          Sign out
        </Button>
      </Card>
    </Screen>
  );
}
