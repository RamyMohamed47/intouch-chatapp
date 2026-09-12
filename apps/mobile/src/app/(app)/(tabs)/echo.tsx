import {
  AiScopeKind,
  AiSummaryMode,
  AiTask,
  aiResponseRequestSchema,
  type AiResponseRequest,
  type AiWorkspaceSource,
} from "@intouch/shared/ai";
import {
  useInfiniteQuery,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { router } from "expo-router";
import { Send, Sparkles, Square } from "lucide-react-native";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import { MainScreenHeader } from "@/components/app-shell";
import { EchoConversationPicker } from "@/components/echo-conversation-picker";
import { Button, Card, Muted } from "@/components/ui/controls";
import { Screen, StateView } from "@/components/ui/screen";
import { aiApi, streamAiResponse } from "@/features/ai/ai-api";
import {
  buildEchoConversationOptions,
  type EchoConversationOption,
} from "@/features/ai/echo-conversations";
import {
  buildEchoHistory,
  describeEchoFailure,
  isRetryableEchoFailure,
} from "@/features/ai/echo-turn";
import { useAppearance } from "@/features/appearance/appearance-provider";
import { conversationsApi } from "@/features/conversations/conversations-api";
import { useWorkspace } from "@/features/organizations/workspace-provider";

interface EchoTurn {
  id: string;
  prompt: string;
  response: string;
  sources: AiWorkspaceSource[];
  pending: boolean;
  error: string | null;
  errorCode: string | null;
  request: AiResponseRequest;
  retryable: boolean;
}

const DISCLOSURE_ACKNOWLEDGEMENT = true as const;

export default function EchoScreen() {
  const { theme } = useAppearance();
  const { activeOrganizationId } = useWorkspace();
  const queryClient = useQueryClient();
  const listRef = useRef<FlatList<EchoTurn>>(null);
  const controllerRef = useRef<AbortController | null>(null);
  const previousOrganizationRef = useRef(activeOrganizationId);
  const [prompt, setPrompt] = useState("");
  const [selectedConversation, setSelectedConversation] =
    useState<EchoConversationOption | null>(null);
  const [mode, setMode] = useState<"ASK" | "SUMMARY" | "ACTION_ITEMS">("ASK");
  const [turns, setTurns] = useState<EchoTurn[]>([]);
  const [nearBottom, setNearBottom] = useState(true);
  const running = turns.some(({ pending }) => pending);
  const settings = useQuery({
    queryKey: ["organizations", activeOrganizationId, "ai-settings"],
    queryFn: () => aiApi.getSettings(activeOrganizationId ?? ""),
    enabled: Boolean(activeOrganizationId),
  });
  const channels = useQuery({
    queryKey: [
      "organizations",
      activeOrganizationId,
      "conversations",
      "channels",
    ],
    queryFn: () => conversationsApi.channels(activeOrganizationId ?? ""),
    enabled: Boolean(activeOrganizationId),
  });
  const directMessages = useInfiniteQuery({
    queryKey: [
      "organizations",
      activeOrganizationId,
      "conversations",
      "directs",
    ],
    queryFn: ({ pageParam }) =>
      conversationsApi.directMessages(activeOrganizationId ?? "", pageParam),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: ({ nextCursor }) => nextCursor ?? undefined,
    enabled: Boolean(activeOrganizationId),
  });
  const conversationOptions = useMemo(
    () =>
      buildEchoConversationOptions(
        channels.data ?? [],
        directMessages.data?.pages.flatMap((page) => page.directMessages) ?? [],
      ),
    [channels.data, directMessages.data],
  );

  useEffect(() => {
    if (previousOrganizationRef.current !== activeOrganizationId) {
      controllerRef.current?.abort();
      setTurns([]);
      setPrompt("");
      setSelectedConversation(null);
      previousOrganizationRef.current = activeOrganizationId;
    }
  }, [activeOrganizationId]);

  useEffect(
    () => () => {
      controllerRef.current?.abort();
    },
    [],
  );

  const updateSettings = async (enabled: boolean) => {
    if (!activeOrganizationId || !settings.data) return;
    await aiApi.updateSettings(activeOrganizationId, {
      enabled,
      disclosureVersion: settings.data.disclosureVersion,
      ...(enabled
        ? { acceptsProviderDataUse: DISCLOSURE_ACKNOWLEDGEMENT }
        : {}),
    });
    await queryClient.invalidateQueries({
      queryKey: ["organizations", activeOrganizationId, "ai-settings"],
    });
  };

  const acceptConsent = async () => {
    if (!activeOrganizationId || !settings.data) return;
    await aiApi.acceptConsent(activeOrganizationId, {
      disclosureVersion: settings.data.disclosureVersion,
      acceptsProviderDataUse: DISCLOSURE_ACKNOWLEDGEMENT,
    });
    await queryClient.invalidateQueries({
      queryKey: ["organizations", activeOrganizationId, "ai-settings"],
    });
  };

  const runTurn = async (id: string, input: AiResponseRequest) => {
    if (!activeOrganizationId || controllerRef.current) return;
    const controller = new AbortController();
    controllerRef.current = controller;
    try {
      await streamAiResponse(
        activeOrganizationId,
        input,
        controller.signal,
        (event) => {
          setTurns((current) =>
            current.map((turn) => {
              if (turn.id !== id) return turn;
              if (event.type === "delta") {
                return { ...turn, response: turn.response + event.text };
              }
              if (event.type === "sources") {
                return { ...turn, sources: event.sources };
              }
              if (event.type === "completed") {
                return { ...turn, pending: false };
              }
              if (event.type === "error") {
                return {
                  ...turn,
                  pending: false,
                  error: event.message,
                  errorCode: event.code,
                  retryable: isRetryableEchoFailure({ code: event.code }),
                };
              }
              return turn;
            }),
          );
        },
      );
      setTurns((current) =>
        current.map((turn) =>
          turn.id === id ? { ...turn, pending: false } : turn,
        ),
      );
    } catch (error) {
      setTurns((current) =>
        current.map((turn) => {
          if (turn.id !== id) return turn;
          if (controller.signal.aborted) {
            return { ...turn, pending: false, error: null, retryable: false };
          }
          const failure = describeEchoFailure(error);
          return {
            ...turn,
            pending: false,
            error: failure.message,
            errorCode: failure.code,
            retryable: failure.retryable,
          };
        }),
      );
    } finally {
      if (controllerRef.current === controller) controllerRef.current = null;
    }
  };

  const submit = async () => {
    if (!activeOrganizationId || controllerRef.current) return;
    const trimmedPrompt = prompt.trim();
    const selectedConversationId = selectedConversation?.id;
    if (mode === "ASK" && trimmedPrompt.length < 2) return;
    if (mode !== "ASK" && !selectedConversationId) return;

    const id = `${Date.now()}-${Math.random()}`;
    const history = buildEchoHistory(turns);
    let input: AiResponseRequest;
    if (mode === "ASK") {
      input = aiResponseRequestSchema.parse({
        task: AiTask.ASK,
        prompt: trimmedPrompt,
        scope: selectedConversation
          ? {
              kind: AiScopeKind.CONVERSATION,
              conversationId: selectedConversation.id,
            }
          : { kind: AiScopeKind.ORGANIZATION },
        ...(history.length ? { history } : {}),
      });
    } else {
      if (!selectedConversationId) return;
      input = aiResponseRequestSchema.parse({
        task: AiTask.SUMMARIZE,
        conversationId: selectedConversationId,
        mode:
          mode === "SUMMARY"
            ? AiSummaryMode.SUMMARY
            : AiSummaryMode.ACTION_ITEMS,
      });
    }
    const turnPrompt =
      mode === "ASK"
        ? trimmedPrompt
        : mode === "SUMMARY"
          ? "Summarize this conversation"
          : "Extract action items";
    setPrompt("");
    setTurns((current) => [
      ...current,
      {
        id,
        prompt: turnPrompt,
        response: "",
        sources: [],
        pending: true,
        error: null,
        errorCode: null,
        request: input,
        retryable: false,
      },
    ]);
    await runTurn(id, input);
  };

  const retry = async (turn: EchoTurn) => {
    if (controllerRef.current || !turn.retryable) return;
    setTurns((current) =>
      current.map((candidate) =>
        candidate.id === turn.id
          ? {
              ...candidate,
              response: "",
              sources: [],
              pending: true,
              error: null,
              errorCode: null,
              retryable: false,
            }
          : candidate,
      ),
    );
    await runTurn(turn.id, turn.request);
  };

  if (!activeOrganizationId) {
    return (
      <Screen>
        <MainScreenHeader title="Echo" />
        <StateView
          title="Choose a workspace"
          message="Echo answers questions within your active workspace."
        />
      </Screen>
    );
  }
  if (settings.isLoading) {
    return (
      <StateView loading title="Opening Echo" message="Checking AI access." />
    );
  }
  if (!settings.data?.available) {
    return (
      <Screen>
        <MainScreenHeader title="Echo" />
        <StateView
          title="Echo is unavailable"
          message="The AI provider is not configured for this environment."
        />
      </Screen>
    );
  }
  if (!settings.data.organizationEnabled) {
    return (
      <Screen>
        <MainScreenHeader title="Echo" />
        <Card>
          <Sparkles color={theme.accent} size={32} />
          <Text style={[styles.sectionTitle, { color: theme.text }]}>
            Echo is off
          </Text>
          <Muted>An owner must enable AI assistance for this workspace.</Muted>
          {settings.data.canManage ? (
            <Button onPress={() => void updateSettings(true)}>
              Enable Echo
            </Button>
          ) : null}
        </Card>
      </Screen>
    );
  }
  if (!settings.data.userConsentAccepted) {
    return (
      <Screen>
        <MainScreenHeader title="Echo" />
        <Card>
          <Text style={[styles.sectionTitle, { color: theme.text }]}>
            Before you begin
          </Text>
          <Muted>{settings.data.dataUseNotice}</Muted>
          <Button onPress={() => void acceptConsent()}>
            I understand and continue
          </Button>
        </Card>
      </Screen>
    );
  }

  return (
    <Screen scroll={false}>
      <View style={styles.page}>
        <MainScreenHeader
          subtitle={`${settings.data.quota.userRemaining} requests remaining today`}
          title="Echo"
        />
        <View style={styles.modeRow}>
          {(["ASK", "SUMMARY", "ACTION_ITEMS"] as const).map((option) => (
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ selected: mode === option }}
              key={option}
              onPress={() => setMode(option)}
              style={[
                styles.mode,
                {
                  backgroundColor:
                    mode === option ? theme.accentSoft : theme.panel,
                  borderColor: mode === option ? theme.accent : theme.border,
                },
              ]}
            >
              <Text style={{ color: theme.text, fontWeight: "800" }}>
                {option === "ASK"
                  ? "Ask"
                  : option === "SUMMARY"
                    ? "Summary"
                    : "Actions"}
              </Text>
            </Pressable>
          ))}
        </View>
        <FlatList
          ref={listRef}
          contentContainerStyle={styles.turns}
          data={turns}
          keyExtractor={({ id }) => id}
          ListEmptyComponent={
            <StateView
              title="Ask Echo"
              message="Get answers grounded in conversations you can access."
              action={<Sparkles color={theme.accent} size={34} />}
            />
          }
          onContentSizeChange={() => {
            if (nearBottom) listRef.current?.scrollToEnd({ animated: true });
          }}
          onScroll={({ nativeEvent }) => {
            const distance =
              nativeEvent.contentSize.height -
              nativeEvent.layoutMeasurement.height -
              nativeEvent.contentOffset.y;
            setNearBottom(distance < 120);
          }}
          renderItem={({ item }) => (
            <View style={styles.turn}>
              <View
                style={[styles.prompt, { backgroundColor: theme.accentSoft }]}
              >
                <Text style={{ color: theme.text }}>{item.prompt}</Text>
              </View>
              <Card>
                <Text
                  style={{ color: theme.text, fontSize: 15, lineHeight: 23 }}
                >
                  {item.response ||
                    (item.pending ? "Echo is thinking..." : "No response")}
                </Text>
                {item.error ? (
                  <View style={styles.failure}>
                    <Text style={{ color: theme.danger }}>{item.error}</Text>
                    {item.retryable ? (
                      <Button
                        disabled={running}
                        onPress={() => void retry(item)}
                        variant="secondary"
                      >
                        Retry
                      </Button>
                    ) : null}
                  </View>
                ) : null}
                {item.sources.map((source) => (
                  <Pressable
                    accessibilityRole="link"
                    key={source.sourceId}
                    onPress={() =>
                      router.push({
                        pathname: "/conversation/[conversationId]",
                        params: {
                          conversationId: source.conversationId,
                          messageId: source.messageId,
                        },
                      })
                    }
                    style={[styles.source, { borderColor: theme.border }]}
                  >
                    <Text style={{ color: theme.accent, fontWeight: "800" }}>
                      {source.conversationLabel}
                    </Text>
                    <Muted>{source.excerpt}</Muted>
                  </Pressable>
                ))}
              </Card>
            </View>
          )}
          scrollEventThrottle={100}
        />
        <View
          style={[
            styles.composer,
            { borderColor: theme.border, backgroundColor: theme.panel },
          ]}
        >
          <EchoConversationPicker
            allowWorkspace={mode === "ASK"}
            hasMoreDirectMessages={Boolean(directMessages.hasNextPage)}
            loadingMoreDirectMessages={directMessages.isFetchingNextPage}
            onLoadMoreDirectMessages={() => void directMessages.fetchNextPage()}
            onSelect={setSelectedConversation}
            options={conversationOptions}
            selected={selectedConversation}
          />
          {mode === "ASK" ? (
            <TextInput
              accessibilityLabel="Ask Echo"
              maxLength={1000}
              multiline
              onChangeText={setPrompt}
              placeholder="Ask about your workspace..."
              placeholderTextColor={theme.muted}
              style={[
                styles.input,
                { color: theme.text, backgroundColor: theme.panelStrong },
              ]}
              value={prompt}
            />
          ) : null}
          {running ? (
            <Pressable
              accessibilityLabel="Stop Echo response"
              onPress={() => controllerRef.current?.abort()}
              style={[styles.send, { backgroundColor: theme.danger }]}
            >
              <Square color="#ffffff" fill="#ffffff" size={17} />
            </Pressable>
          ) : (
            <Pressable
              accessibilityLabel="Send to Echo"
              disabled={
                mode === "ASK"
                  ? prompt.trim().length < 2
                  : !selectedConversation
              }
              onPress={() => void submit()}
              style={[styles.send, { backgroundColor: theme.accent }]}
            >
              <Send color="#ffffff" size={19} />
            </Pressable>
          )}
        </View>
        {settings.data.canManage ? (
          <Pressable onPress={() => void updateSettings(false)}>
            <Text style={{ color: theme.muted, textAlign: "center" }}>
              Disable Echo for workspace
            </Text>
          </Pressable>
        ) : null}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, gap: 12, padding: 16 },
  sectionTitle: { fontSize: 22, fontWeight: "900" },
  modeRow: { flexDirection: "row", gap: 8 },
  mode: {
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 9,
  },
  turns: { flexGrow: 1, gap: 14, paddingBottom: 10 },
  turn: { gap: 8 },
  prompt: {
    alignSelf: "flex-end",
    borderRadius: 17,
    maxWidth: "86%",
    padding: 12,
  },
  source: { borderTopWidth: 1, gap: 3, paddingTop: 9 },
  failure: { gap: 8 },
  composer: {
    alignItems: "flex-end",
    borderRadius: 18,
    borderWidth: 1,
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    padding: 9,
  },
  input: {
    borderRadius: 14,
    flex: 1,
    maxHeight: 110,
    minHeight: 44,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  send: {
    alignItems: "center",
    borderRadius: 22,
    height: 44,
    justifyContent: "center",
    width: 44,
  },
});
