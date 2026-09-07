import {
  ChatWallpaperId,
  type ChatWallpaperIdType,
} from "@intouch/shared/chat-wallpapers";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { Button, Card, Heading, Muted } from "@/components/ui/controls";
import { Screen } from "@/components/ui/screen";
import { ChatWallpaper } from "@/features/appearance/chat-wallpaper";
import { useAppearance } from "@/features/appearance/appearance-provider";
import { wallpaperApi } from "@/features/appearance/wallpaper-api";

const labels: Record<ChatWallpaperIdType, string> = {
  NONE: "Plain",
  INTOUCH_DOODLE: "InTouch doodle",
  DOODLE_ORBIT: "Orbit doodle",
  DOODLE_CHAT: "Chat notes",
  DOODLE_NIGHT: "Night signals",
  ABSTRACT_AURORA: "Aurora flow",
  ABSTRACT_SUNSET: "Sunset glass",
  ABSTRACT_OCEAN: "Ocean depth",
  ABSTRACT_PAPER: "Soft paper",
  SCENERY_COAST: "Blue-hour coast",
  SCENERY_MOUNTAINS: "Misty mountains",
  SCENERY_FOREST: "Forest light",
  SCENERY_CITY_LIGHTS: "City reflections",
};

export default function WallpaperScreen() {
  const { conversationId = "" } = useLocalSearchParams<{
    conversationId: string;
  }>();
  const { theme } = useAppearance();
  const queryClient = useQueryClient();
  const isDefault = conversationId === "default";
  const current = useQuery({
    queryKey: isDefault
      ? ["users", "me", "wallpaper"]
      : ["conversations", conversationId, "wallpaper"],
    queryFn: () =>
      isDefault ? wallpaperApi.getDefault() : wallpaperApi.get(conversationId),
  });
  const [selected, setSelected] = useState<ChatWallpaperIdType>(
    current.data?.wallpaperId ?? ChatWallpaperId.NONE,
  );
  const [dimming, setDimming] = useState(current.data?.dimming ?? 20);

  useEffect(() => {
    if (!current.data) return;
    setSelected(current.data.wallpaperId);
    setDimming(current.data.dimming);
  }, [current.data]);

  const save = async () => {
    const input = {
      wallpaperId: selected,
      dimming: selected === ChatWallpaperId.NONE ? 0 : dimming,
    };
    if (isDefault) await wallpaperApi.setDefault(input);
    else await wallpaperApi.set(conversationId, input);
    await queryClient.invalidateQueries({
      queryKey: isDefault
        ? ["users", "me", "wallpaper"]
        : ["conversations", conversationId, "wallpaper"],
    });
    if (isDefault) {
      await queryClient.invalidateQueries({
        predicate: ({ queryKey }) => queryKey.includes("wallpaper"),
      });
    }
    router.back();
  };

  return (
    <Screen>
      <Button onPress={() => router.back()} variant="ghost">
        Back
      </Button>
      <Heading>Chat atmosphere</Heading>
      <Muted>
        {isDefault
          ? "Choose the default atmosphere for conversations without an override."
          : "Wallpapers stay synchronized with this conversation preference."}
      </Muted>
      <View style={[styles.preview, { borderColor: theme.border }]}>
        <ChatWallpaper
          wallpaper={{ wallpaperId: selected, dimming, source: "CONVERSATION" }}
        />
      </View>
      <View style={styles.grid}>
        {Object.values(ChatWallpaperId).map((id) => (
          <Pressable
            key={id}
            onPress={() => setSelected(id)}
            style={styles.cell}
          >
            <Card>
              <Text
                style={{
                  color: selected === id ? theme.accent : theme.text,
                  fontWeight: "800",
                }}
              >
                {labels[id]}
              </Text>
            </Card>
          </Pressable>
        ))}
      </View>
      <Muted>Dimming</Muted>
      <View style={styles.dimming}>
        {[0, 20, 40, 60].map((value) => (
          <View style={{ flex: 1 }} key={value}>
            <Button
              onPress={() => setDimming(value)}
              variant={dimming === value ? "primary" : "secondary"}
            >
              {value}%
            </Button>
          </View>
        ))}
      </View>
      <Button onPress={() => void save()}>Apply wallpaper</Button>
      {!isDefault ? (
        <Button
          onPress={() =>
            void wallpaperApi.reset(conversationId).then(async () => {
              await queryClient.invalidateQueries({
                queryKey: ["conversations", conversationId, "wallpaper"],
              });
              router.back();
            })
          }
          variant="ghost"
        >
          Use my default
        </Button>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  preview: {
    height: 190,
    borderRadius: 22,
    borderWidth: 1,
    overflow: "hidden",
  },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  cell: { width: "48%" },
  dimming: { flexDirection: "row", gap: 8 },
});
