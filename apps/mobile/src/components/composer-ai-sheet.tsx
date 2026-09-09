import { AiComposeAction, AiTask } from "@intouch/shared/ai";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import {
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import { Button, Muted } from "@/components/ui/controls";
import { aiApi, streamAiResponse } from "@/features/ai/ai-api";
import { useAppearance } from "@/features/appearance/appearance-provider";

const ACTIONS = [
  [AiComposeAction.REWRITE_PROFESSIONAL, "Professional rewrite"],
  [AiComposeAction.SHORTEN, "Shorten"],
  [AiComposeAction.FIX_GRAMMAR, "Fix grammar"],
  [AiComposeAction.TRANSLATE, "Translate"],
] as const;

export const ComposerAiSheet = ({
  organizationId,
  onApply,
  onClose,
  text,
  visible,
}: {
  organizationId: string;
  onApply: (value: string) => void;
  onClose: () => void;
  text: string;
  visible: boolean;
}) => {
  const { theme } = useAppearance();
  const controllerRef = useRef<AbortController | null>(null);
  const [targetLanguage, setTargetLanguage] = useState("English");
  const [preview, setPreview] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const settings = useQuery({
    queryKey: ["organizations", organizationId, "ai-settings"],
    queryFn: () => aiApi.getSettings(organizationId),
    enabled: visible && Boolean(organizationId),
  });

  useEffect(
    () => () => {
      controllerRef.current?.abort();
    },
    [],
  );

  const transform = async (action: (typeof ACTIONS)[number][0]) => {
    if (!text.trim() || pending) return;
    setPreview("");
    setError(null);
    setPending(true);
    const controller = new AbortController();
    controllerRef.current = controller;
    try {
      await streamAiResponse(
        organizationId,
        {
          task: AiTask.COMPOSE,
          action,
          text,
          ...(action === AiComposeAction.TRANSLATE
            ? { targetLanguage: targetLanguage.trim() }
            : {}),
        },
        controller.signal,
        (event) => {
          if (event.type === "delta") {
            setPreview((current) => current + event.text);
          }
          if (event.type === "error") setError(event.message);
        },
      );
    } catch (caught) {
      if (!controller.signal.aborted) {
        setError(
          caught instanceof Error
            ? caught.message
            : "Echo could not transform this draft",
        );
      }
    } finally {
      if (controllerRef.current === controller) controllerRef.current = null;
      setPending(false);
    }
  };

  const close = () => {
    controllerRef.current?.abort();
    setPreview("");
    setError(null);
    onClose();
  };

  return (
    <Modal
      animationType="slide"
      onRequestClose={close}
      transparent
      visible={visible}
    >
      <Pressable onPress={close} style={styles.backdrop}>
        <Pressable
          accessibilityViewIsModal
          onPress={(event) => event.stopPropagation()}
          style={[
            styles.sheet,
            { backgroundColor: theme.panel, borderColor: theme.border },
          ]}
        >
          <Text style={[styles.title, { color: theme.text }]}>
            Polish with Echo
          </Text>
          {!settings.data?.organizationEnabled ||
          !settings.data.userConsentAccepted ? (
            <Muted>
              Enable Echo and accept its data-use notice from the Echo tab
              first.
            </Muted>
          ) : (
            <>
              <TextInput
                accessibilityLabel="Translation language"
                onChangeText={setTargetLanguage}
                placeholder="Translation language"
                placeholderTextColor={theme.muted}
                style={[
                  styles.language,
                  { borderColor: theme.border, color: theme.text },
                ]}
                value={targetLanguage}
              />
              <View style={styles.actions}>
                {ACTIONS.map(([action, label]) => (
                  <View key={action} style={styles.action}>
                    <Button
                      disabled={pending || !text.trim()}
                      onPress={() => void transform(action)}
                      variant="secondary"
                    >
                      {label}
                    </Button>
                  </View>
                ))}
              </View>
            </>
          )}
          {pending ? <Muted>Echo is preparing a preview...</Muted> : null}
          {error ? <Text style={{ color: theme.danger }}>{error}</Text> : null}
          {preview ? (
            <View
              style={[styles.preview, { backgroundColor: theme.panelStrong }]}
            >
              <Text style={{ color: theme.text, lineHeight: 21 }}>
                {preview}
              </Text>
              <Button
                onPress={() => {
                  onApply(preview);
                  close();
                }}
              >
                Use this draft
              </Button>
            </View>
          ) : null}
          <Button onPress={close} variant="ghost">
            Close
          </Button>
        </Pressable>
      </Pressable>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    backgroundColor: "rgba(2, 7, 18, 0.7)",
    flex: 1,
    justifyContent: "flex-end",
  },
  sheet: {
    borderTopLeftRadius: 26,
    borderTopRightRadius: 26,
    borderWidth: 1,
    gap: 12,
    padding: 18,
  },
  title: { fontSize: 21, fontWeight: "900" },
  language: {
    borderRadius: 13,
    borderWidth: 1,
    minHeight: 46,
    paddingHorizontal: 12,
  },
  actions: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  action: { flexBasis: "48%", flexGrow: 1 },
  preview: { borderRadius: 15, gap: 10, maxHeight: 220, padding: 13 },
});
