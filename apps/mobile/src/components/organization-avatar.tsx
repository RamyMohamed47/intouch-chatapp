import { useQuery } from "@tanstack/react-query";
import { Image } from "expo-image";
import { StyleSheet, Text, View } from "react-native";

import { useAppearance } from "@/features/appearance/appearance-provider";
import { uploadsApi } from "@/features/uploads/uploads-api";

export const OrganizationAvatar = ({
  logoAssetId,
  name,
  size = 44,
}: {
  logoAssetId: string | null;
  name: string;
  size?: number;
}) => {
  const { theme } = useAppearance();
  const access = useQuery({
    queryKey: ["assets", logoAssetId],
    queryFn: () => uploadsApi.access(logoAssetId ?? ""),
    enabled: Boolean(logoAssetId),
    staleTime: 8 * 60 * 1000,
  });

  const shape = { width: size, height: size, borderRadius: size * 0.3 };
  if (access.data) {
    return (
      <Image
        accessibilityLabel={`${name} logo`}
        contentFit="cover"
        source={access.data.accessUrl}
        style={shape}
      />
    );
  }

  return (
    <View
      accessibilityLabel={`${name} initials`}
      style={[styles.fallback, shape, { backgroundColor: theme.accentSoft }]}
    >
      <Text style={{ color: theme.text, fontWeight: "900" }}>
        {name.trim().slice(0, 1).toUpperCase() || "?"}
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  fallback: { alignItems: "center", justifyContent: "center" },
});
