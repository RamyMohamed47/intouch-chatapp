import type { AttachmentDto } from "@intouch/shared/uploads";
import { useQuery } from "@tanstack/react-query";
import { Image } from "expo-image";
import * as FileSystem from "expo-file-system/legacy";
import * as Sharing from "expo-sharing";
import { FileText } from "lucide-react-native";
import { useState } from "react";
import { Modal, Pressable, StyleSheet, Text, View } from "react-native";

import { useAppearance } from "@/features/appearance/appearance-provider";
import { uploadsApi } from "@/features/uploads/uploads-api";

const formatBytes = (bytes: number) =>
  bytes < 1_048_576
    ? `${Math.ceil(bytes / 1024)} KB`
    : `${(bytes / 1_048_576).toFixed(1)} MB`;

export const AttachmentView = ({
  attachment,
}: {
  attachment: AttachmentDto;
}) => {
  const { theme } = useAppearance();
  const [previewOpen, setPreviewOpen] = useState(false);
  const access = useQuery({
    queryKey: ["assets", attachment.id],
    queryFn: () => uploadsApi.access(attachment.id),
    staleTime: 8 * 60 * 1000,
  });
  if (attachment.kind === "IMAGE") {
    return access.data ? (
      <>
        <Pressable
          accessibilityLabel={`Open ${attachment.fileName} preview`}
          onPress={() => setPreviewOpen(true)}
        >
          <Image
            accessibilityLabel={attachment.fileName}
            contentFit="cover"
            source={access.data.accessUrl}
            style={styles.image}
          />
        </Pressable>
        <Modal
          animationType="fade"
          onRequestClose={() => setPreviewOpen(false)}
          transparent
          visible={previewOpen}
        >
          <View style={styles.previewBackdrop}>
            <Image
              accessibilityLabel={attachment.fileName}
              contentFit="contain"
              source={access.data.accessUrl}
              style={styles.previewImage}
            />
            <Pressable
              accessibilityLabel="Close image preview"
              accessibilityRole="button"
              onPress={() => setPreviewOpen(false)}
              style={styles.close}
            >
              <Text style={styles.closeText}>Close</Text>
            </Pressable>
          </View>
        </Modal>
      </>
    ) : (
      <View style={[styles.image, { backgroundColor: theme.panelStrong }]} />
    );
  }

  const open = async () => {
    if (!access.data) return;
    const extension =
      /\.[a-zA-Z0-9]{1,8}$/.exec(attachment.fileName)?.[0] ?? "";
    const destination = `${FileSystem.cacheDirectory}${attachment.id}${extension}`;
    try {
      const result = await FileSystem.downloadAsync(
        access.data.accessUrl,
        destination,
      );
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(result.uri, {
          mimeType: attachment.contentType,
        });
      }
    } finally {
      await FileSystem.deleteAsync(destination, { idempotent: true });
    }
  };

  return (
    <Pressable
      accessibilityLabel={`Open ${attachment.fileName}`}
      onPress={() => void open()}
      style={[styles.file, { backgroundColor: theme.panelStrong }]}
    >
      <FileText color={theme.accent} size={24} />
      <View style={{ flex: 1 }}>
        <Text
          numberOfLines={1}
          style={{ color: theme.text, fontWeight: "800" }}
        >
          {attachment.fileName}
        </Text>
        <Text style={{ color: theme.muted }}>
          {formatBytes(attachment.size)}
        </Text>
      </View>
    </Pressable>
  );
};

const styles = StyleSheet.create({
  image: { width: 220, height: 170, borderRadius: 14 },
  previewBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.94)",
    padding: 20,
    justifyContent: "center",
  },
  previewImage: { flex: 1, width: "100%" },
  close: {
    minHeight: 48,
    alignItems: "center",
    justifyContent: "center",
  },
  closeText: { color: "#ffffff", fontSize: 16, fontWeight: "800" },
  file: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderRadius: 12,
    padding: 12,
  },
});
