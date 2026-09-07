import { useQuery } from "@tanstack/react-query";
import { Image } from "expo-image";
import { StyleSheet, Text, View } from "react-native";

import { useAppearance } from "@/features/appearance/appearance-provider";
import { uploadsApi } from "@/features/uploads/uploads-api";

export const UserAvatar = ({
  assetId,
  displayName,
  externalUrl,
  online = false,
  size = 44,
}: {
  assetId?: string | null | undefined;
  displayName: string;
  externalUrl?: string | undefined;
  online?: boolean;
  size?: number;
}) => {
  const { theme } = useAppearance();
  const access = useQuery({
    queryKey: ["assets", assetId],
    queryFn: () => uploadsApi.access(assetId ?? ""),
    enabled: Boolean(assetId),
    staleTime: 8 * 60 * 1000,
  });
  const uri = access.data?.accessUrl ?? externalUrl;
  return (
    <View style={{ width: size, height: size }}>
      {uri ? (
        <Image
          source={uri}
          style={{ width: size, height: size, borderRadius: size / 2 }}
        />
      ) : (
        <View
          style={[
            styles.fallback,
            {
              width: size,
              height: size,
              borderRadius: size / 2,
              backgroundColor: theme.accentSoft,
            },
          ]}
        >
          <Text style={{ color: theme.text, fontWeight: "800" }}>
            {displayName.trim().slice(0, 1).toUpperCase() || "?"}
          </Text>
        </View>
      )}
      {online ? (
        <View
          accessibilityLabel={`${displayName} is online`}
          style={[
            styles.presence,
            { backgroundColor: theme.success, borderColor: theme.panel },
          ]}
        />
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  fallback: { alignItems: "center", justifyContent: "center" },
  presence: {
    position: "absolute",
    right: -1,
    bottom: -1,
    width: 13,
    height: 13,
    borderRadius: 7,
    borderWidth: 3,
  },
});
