import { ChannelKind, ConversationType } from "@intouch/shared/conversations";
import type { MessageDto, MessageListResponse } from "@intouch/shared/messages";
import * as DocumentPicker from "expo-document-picker";
import * as FileSystem from "expo-file-system/legacy";
import * as ImagePicker from "expo-image-picker";
import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
  type InfiniteData,
} from "@tanstack/react-query";
import {
  router,
  useFocusEffect,
  useIsFocused,
  useLocalSearchParams,
} from "expo-router";
import {
  ArrowDown,
  ImagePlus,
  Palette,
  Paperclip,
  Send,
} from "lucide-react-native";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Alert,
  AppState,
  FlatList,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  type ViewToken,
} from "react-native";

import { BackButton, Button, Muted } from "@/components/ui/controls";
import { MessageActionSheet } from "@/components/message-action-sheet";
import { Screen, StateView } from "@/components/ui/screen";
import { UserAvatar } from "@/components/user-avatar";
import { useAppearance } from "@/features/appearance/appearance-provider";
import { ChatWallpaper } from "@/features/appearance/chat-wallpaper";
import { wallpaperApi } from "@/features/appearance/wallpaper-api";
import { useAuth } from "@/features/auth/auth-provider";
import { conversationsApi } from "@/features/conversations/conversations-api";
import { messagesApi } from "@/features/messages/messages-api";
import { mergeReactionStateIntoMessagePages } from "@/features/messages/reaction-cache";
import {
  callMessageLabel,
  hasReadMessage,
} from "@/features/messages/message-presentation";
import { organizationsApi } from "@/features/organizations/organizations-api";
import { useRealtime } from "@/features/realtime/realtime-provider";
import { AttachmentView } from "@/features/uploads/attachment-view";
import {
  uploadFiles,
  type LocalUploadFile,
} from "@/features/uploads/upload-client";
import { uploadsApi } from "@/features/uploads/uploads-api";

export default function ConversationScreen() {
  const { conversationId = "", messageId } = useLocalSearchParams<{
    conversationId: string;
    messageId?: string;
  }>();
  const anchorMessageId = typeof messageId === "string" ? messageId : "";
  const { theme } = useAppearance();
  const { user } = useAuth();
  const isFocused = useIsFocused();
  const {
    connected,
    joinConversation,
    leaveConversation,
    startTyping,
    stopTyping,
    typingUserIds,
  } = useRealtime();
  const queryClient = useQueryClient();
  const listRef = useRef<FlatList<MessageDto>>(null);
  const pendingReceiptMessageIdRef = useRef<string | null>(null);
  const failedReceiptMessageIdRef = useRef<string | null>(null);
  const uploadAbortControllerRef = useRef<AbortController | null>(null);
  const [content, setContent] = useState("");
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
  const [editingAllowsEmpty, setEditingAllowsEmpty] = useState(false);
  const [files, setFiles] = useState<LocalUploadFile[]>([]);
  const [completedUploadIds, setCompletedUploadIds] = useState<string[]>([]);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadingFileIndex, setUploadingFileIndex] = useState<number | null>(
    null,
  );
  const [showJump, setShowJump] = useState(false);
  const [highlightedMessageId, setHighlightedMessageId] = useState<
    string | null
  >(null);
  const [showReaders, setShowReaders] = useState(false);
  const [reactionViewer, setReactionViewer] = useState<{
    messageId: string;
    emoji: string;
  } | null>(null);
  const [selectedMessageId, setSelectedMessageId] = useState<string | null>(
    null,
  );
  const [reactionPendingMessageId, setReactionPendingMessageId] = useState<
    string | null
  >(null);
  const [latestVisible, setLatestVisible] = useState(true);
  const [appIsActive, setAppIsActive] = useState(
    AppState.currentState === "active",
  );
  const conversation = useQuery({
    queryKey: ["conversations", conversationId],
    queryFn: () => conversationsApi.get(conversationId),
  });
  const organizationId = conversation.data?.organizationId;
  const members = useQuery({
    queryKey: ["organizations", organizationId, "members"],
    queryFn: () => organizationsApi.members(organizationId ?? ""),
    enabled: Boolean(organizationId),
  });
  const wallpaper = useQuery({
    queryKey: ["conversations", conversationId, "wallpaper"],
    queryFn: () => wallpaperApi.get(conversationId),
  });
  const messages = useInfiniteQuery({
    queryKey: ["messages", conversationId],
    queryFn: ({ pageParam }) => messagesApi.list(conversationId, pageParam),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: ({ nextCursor }) => nextCursor ?? undefined,
    enabled: !anchorMessageId,
  });
  const messageContext = useQuery({
    queryKey: ["messages", conversationId, "context", anchorMessageId],
    queryFn: () => messagesApi.context(conversationId, anchorMessageId),
    enabled: Boolean(anchorMessageId),
  });
  const allMessages = useMemo(() => {
    const source = anchorMessageId
      ? (messageContext.data?.messages ?? [])
      : (messages.data?.pages.flatMap((page) => page.messages) ?? []);
    return source
      .filter(
        (message, index, list) =>
          list.findIndex(({ id }) => id === message.id) === index,
      )
      .sort((left, right) => right.createdAt.localeCompare(left.createdAt));
  }, [anchorMessageId, messageContext.data, messages.data]);
  const selectedMessage = allMessages.find(
    ({ id }) => id === selectedMessageId,
  );
  const isVoice =
    conversation.data?.type === ConversationType.CHANNEL &&
    conversation.data.kind === ChannelKind.VOICE;

  useFocusEffect(
    useCallback(() => {
      void joinConversation(conversationId);
      return () => void leaveConversation(conversationId);
    }, [conversationId, joinConversation, leaveConversation]),
  );

  useEffect(() => {
    const subscription = AppState.addEventListener("change", (state) =>
      setAppIsActive(state === "active"),
    );
    return () => subscription.remove();
  }, []);

  useEffect(() => {
    if (!content.trim()) {
      stopTyping(conversationId);
      return;
    }
    startTyping(conversationId);
    const timer = setInterval(() => startTyping(conversationId), 3_000);
    return () => {
      clearInterval(timer);
      stopTyping(conversationId);
    };
  }, [content, conversationId, startTyping, stopTyping]);

  const latest = allMessages[0];
  const atLatestMessage =
    !anchorMessageId || messageContext.data?.hasLater === false;
  const latestOutgoing = allMessages.find(
    (message) =>
      message.senderId === user?.id &&
      !message.deletedAt &&
      message.messageType !== "CALL",
  );
  const readerSummary = useQuery({
    queryKey: ["messages", latestOutgoing?.id, "readers"],
    queryFn: () =>
      messagesApi.readers(conversationId, latestOutgoing?.id ?? ""),
    enabled:
      Boolean(latestOutgoing) &&
      conversation.data?.type === ConversationType.CHANNEL,
  });
  const reactionUsers = useInfiniteQuery({
    queryKey: [
      "messages",
      reactionViewer?.messageId,
      "reaction-users",
      reactionViewer?.emoji,
    ],
    queryFn: ({ pageParam }) =>
      messagesApi.reactionUsers(
        reactionViewer?.messageId ?? "",
        reactionViewer?.emoji ?? "",
        pageParam,
      ),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: ({ nextCursor }) => nextCursor ?? undefined,
    enabled: Boolean(reactionViewer),
  });
  const currentReadReceipt =
    conversation.data && "readReceipt" in conversation.data
      ? conversation.data.readReceipt
      : null;
  const receipt = useMutation({
    mutationFn: (messageId: string) =>
      messagesApi.receipt(conversationId, messageId),
    onSuccess: (readReceipt) => {
      queryClient.setQueryData(
        ["conversations", conversationId],
        (current: typeof conversation.data) =>
          current && "readReceipt" in current
            ? { ...current, readReceipt, unreadCount: 0 }
            : current,
      );
      void queryClient.invalidateQueries({
        queryKey: ["organizations", organizationId, "conversations"],
      });
    },
  });

  useEffect(() => {
    if (!appIsActive || !isFocused || !latestVisible) {
      failedReceiptMessageIdRef.current = null;
    }
  }, [appIsActive, isFocused, latestVisible]);

  useEffect(() => {
    if (
      !latest ||
      !atLatestMessage ||
      !latestVisible ||
      !appIsActive ||
      !isFocused ||
      hasReadMessage(currentReadReceipt, latest.id) ||
      pendingReceiptMessageIdRef.current === latest.id ||
      failedReceiptMessageIdRef.current === latest.id
    ) {
      return;
    }

    pendingReceiptMessageIdRef.current = latest.id;
    receipt.mutate(latest.id, {
      onError: () => {
        failedReceiptMessageIdRef.current = latest.id;
      },
      onSuccess: () => {
        failedReceiptMessageIdRef.current = null;
      },
      onSettled: () => {
        if (pendingReceiptMessageIdRef.current === latest.id) {
          pendingReceiptMessageIdRef.current = null;
        }
      },
    });
  }, [
    appIsActive,
    currentReadReceipt,
    isFocused,
    latest,
    latestVisible,
    atLatestMessage,
    receipt,
  ]);

  useEffect(() => {
    if (!anchorMessageId || !messageContext.data) return;
    const index = allMessages.findIndex(({ id }) => id === anchorMessageId);
    if (index < 0) return;
    const frame = requestAnimationFrame(() => {
      listRef.current?.scrollToIndex({
        index,
        animated: false,
        viewPosition: 0.5,
      });
      setHighlightedMessageId(anchorMessageId);
    });
    const timeout = setTimeout(() => setHighlightedMessageId(null), 2_400);
    return () => {
      cancelAnimationFrame(frame);
      clearTimeout(timeout);
    };
  }, [allMessages, anchorMessageId, messageContext.data]);

  const send = useMutation({
    mutationFn: async () => {
      if (editingMessageId) {
        return messagesApi.update(editingMessageId, {
          content: content.trim() || null,
        });
      }
      let uploadIds = completedUploadIds;
      if (files.length && uploadIds.length === 0) {
        const controller = new AbortController();
        uploadAbortControllerRef.current = controller;
        try {
          uploadIds = await uploadFiles(
            { purpose: "MESSAGE_ATTACHMENT", conversationId, files },
            (index, progress) => {
              setUploadingFileIndex(index);
              setUploadProgress((index + progress) / files.length);
            },
            controller.signal,
          );
        } finally {
          uploadAbortControllerRef.current = null;
          setUploadingFileIndex(null);
        }
        setCompletedUploadIds(uploadIds);
      }
      return messagesApi.create(conversationId, {
        ...(content.trim() ? { content: content.trim() } : {}),
        ...(uploadIds.length ? { uploadIds } : {}),
      });
    },
    onSuccess: async () => {
      setContent("");
      setEditingMessageId(null);
      setEditingAllowsEmpty(false);
      setFiles([]);
      setCompletedUploadIds([]);
      setUploadProgress(0);
      setUploadingFileIndex(null);
      stopTyping(conversationId);
      await queryClient.invalidateQueries({
        queryKey: ["messages", conversationId],
      });
      listRef.current?.scrollToOffset({ offset: 0, animated: true });
    },
  });

  const clearAttachments = async () => {
    uploadAbortControllerRef.current?.abort();
    const uploadIds = completedUploadIds;
    setFiles([]);
    setCompletedUploadIds([]);
    setUploadProgress(0);
    setUploadingFileIndex(null);
    send.reset();
    await Promise.allSettled(uploadIds.map((id) => uploadsApi.cancel(id)));
  };

  const pickDocuments = async () => {
    const picked = await DocumentPicker.getDocumentAsync({
      multiple: true,
      copyToCacheDirectory: true,
    });
    if (picked.canceled) return;
    await clearAttachments();
    setFiles(
      picked.assets.slice(0, 5).flatMap((asset) =>
        asset.size && asset.mimeType
          ? [
              {
                contentType: asset.mimeType,
                fileName: asset.name,
                size: asset.size,
                uri: asset.uri,
              },
            ]
          : [],
      ),
    );
  };
  const pickImages = async () => {
    const picked = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsMultipleSelection: true,
      selectionLimit: 5,
    });
    if (picked.canceled) return;
    await clearAttachments();
    const next = await Promise.all(
      picked.assets.map(async (asset) => {
        const info = await FileSystem.getInfoAsync(asset.uri);
        return {
          contentType: asset.mimeType ?? "image/jpeg",
          fileName: asset.fileName ?? `photo-${Date.now()}.jpg`,
          size: info.exists && typeof info.size === "number" ? info.size : 0,
          uri: asset.uri,
        };
      }),
    );
    setFiles(next.filter(({ size }) => size > 0).slice(0, 5));
  };

  const mutateReaction = async (message: MessageDto, emoji: string) => {
    setReactionPendingMessageId(message.id);
    try {
      const reactionState =
        message.currentUserReaction === emoji
          ? await messagesApi.removeReaction(message.id)
          : await messagesApi.setReaction(message.id, { emoji });
      queryClient.setQueryData<InfiniteData<MessageListResponse>>(
        ["messages", conversationId],
        (current) => mergeReactionStateIntoMessagePages(current, reactionState),
      );
      await queryClient.invalidateQueries({
        queryKey: ["messages", message.id, "reaction-users"],
      });
      return true;
    } catch (caught) {
      Alert.alert(
        "Reaction failed",
        caught instanceof Error ? caught.message : "Please try again.",
      );
      return false;
    } finally {
      setReactionPendingMessageId(null);
    }
  };

  const startEditing = (message: MessageDto) => {
    setSelectedMessageId(null);
    setContent(message.content ?? "");
    setEditingMessageId(message.id);
    setEditingAllowsEmpty(message.attachments.length > 0);
  };

  const onViewableItemsChanged = useRef(
    ({ viewableItems }: { viewableItems: ViewToken<MessageDto>[] }) => {
      const atLatest = viewableItems.some(({ index }) => index === 0);
      setLatestVisible(atLatest);
      setShowJump(!atLatest);
    },
  ).current;

  if (conversation.isLoading || (anchorMessageId && messageContext.isLoading)) {
    return (
      <StateView
        loading
        title="Opening conversation"
        message="Loading secure history."
      />
    );
  }
  if (isVoice) {
    return (
      <Screen>
        <BackButton onPress={() => router.back()} />
        <StateView
          title="Voice is available on web"
          message="Mobile audio rooms arrive after the V1 text foundation."
        />
      </Screen>
    );
  }

  const title =
    conversation.data?.type === ConversationType.DIRECT
      ? conversation.data.peer.displayName
      : (conversation.data?.name ?? "Conversation");
  const typingNames = typingUserIds(conversationId).map(
    (id) =>
      members.data?.find((member) => member.user.id === id)?.user.displayName ??
      "A teammate",
  );

  return (
    <Screen scroll={false}>
      <View
        style={[
          styles.header,
          { borderBottomColor: theme.border, backgroundColor: theme.panel },
        ]}
      >
        <BackButton onPress={() => router.back()} />
        <View style={{ flex: 1 }}>
          <Text style={[styles.title, { color: theme.text }]}>{title}</Text>
          <Muted>{connected ? "Live" : "Reconnecting"}</Muted>
        </View>
        <Pressable
          accessibilityLabel="Change chat wallpaper"
          onPress={() => router.push(`/wallpaper/${conversationId}`)}
        >
          <Palette color={theme.accent} size={22} />
        </Pressable>
      </View>
      {anchorMessageId ? (
        <View
          style={[
            styles.contextBanner,
            {
              backgroundColor: theme.accentSoft,
              borderBottomColor: theme.border,
            },
          ]}
        >
          <Text style={[styles.contextText, { color: theme.text }]}>
            Viewing a notification in context
          </Text>
          <Button
            onPress={() =>
              router.replace({
                pathname: "/conversation/[conversationId]",
                params: { conversationId },
              })
            }
            variant="ghost"
          >
            Jump to latest
          </Button>
        </View>
      ) : null}
      <View style={styles.history}>
        <ChatWallpaper wallpaper={wallpaper.data} />
        <FlatList
          ref={listRef}
          data={allMessages}
          inverted
          keyboardDismissMode={
            Platform.OS === "ios" ? "interactive" : "on-drag"
          }
          keyboardShouldPersistTaps="handled"
          maintainVisibleContentPosition={{ minIndexForVisible: 0 }}
          keyExtractor={({ id }) => id}
          contentContainerStyle={styles.messages}
          onEndReached={() =>
            !anchorMessageId &&
            messages.hasNextPage &&
            void messages.fetchNextPage()
          }
          onEndReachedThreshold={0.35}
          onViewableItemsChanged={onViewableItemsChanged}
          onScrollToIndexFailed={({ index }) =>
            listRef.current?.scrollToOffset({
              offset: index * 120,
              animated: false,
            })
          }
          renderItem={({ item }) => {
            const sender = members.data?.find(
              (member) => member.user.id === item.senderId,
            )?.user;
            const mine = item.senderId === user?.id;
            return (
              <Pressable
                accessibilityHint={
                  !item.deletedAt && item.messageType !== "CALL"
                    ? "Long press for reactions and message actions"
                    : undefined
                }
                delayLongPress={350}
                onLongPress={() =>
                  !item.deletedAt && item.messageType !== "CALL"
                    ? setSelectedMessageId(item.id)
                    : undefined
                }
                style={[styles.messageRow, mine && styles.mine]}
              >
                <View
                  style={[
                    styles.bubble,
                    {
                      backgroundColor: mine ? theme.accentSoft : theme.panel,
                      borderColor:
                        highlightedMessageId === item.id
                          ? theme.accent
                          : theme.border,
                      borderWidth: highlightedMessageId === item.id ? 2 : 1,
                    },
                  ]}
                >
                  <Text
                    style={{
                      color: theme.muted,
                      fontSize: 12,
                      fontWeight: "800",
                    }}
                  >
                    {mine ? "You" : (sender?.displayName ?? "Member")}
                  </Text>
                  {item.deletedAt ? (
                    <Text style={{ color: theme.muted, fontStyle: "italic" }}>
                      Message deleted
                    </Text>
                  ) : item.messageType === "CALL" ? (
                    <Text style={{ color: theme.text, fontWeight: "800" }}>
                      {callMessageLabel(item, user?.id)}
                    </Text>
                  ) : (
                    <>
                      {item.attachments.map((attachment) => (
                        <AttachmentView
                          attachment={attachment}
                          key={attachment.id}
                        />
                      ))}
                      {item.content ? (
                        <Text style={{ color: theme.text, fontSize: 16 }}>
                          {item.content}
                        </Text>
                      ) : null}
                      <View style={styles.reactions}>
                        {item.reactions.map((reaction) => (
                          <View
                            key={reaction.emoji}
                            style={[
                              styles.reaction,
                              { backgroundColor: theme.panelStrong },
                            ]}
                          >
                            <Pressable
                              accessibilityLabel={`${item.currentUserReaction === reaction.emoji ? "Remove" : "Add"} ${reaction.emoji} reaction`}
                              accessibilityRole="button"
                              accessibilityState={{
                                disabled: reactionPendingMessageId === item.id,
                                selected:
                                  item.currentUserReaction === reaction.emoji,
                              }}
                              disabled={reactionPendingMessageId === item.id}
                              onPress={() =>
                                void mutateReaction(item, reaction.emoji)
                              }
                              style={styles.reactionSegment}
                            >
                              <Text>{reaction.emoji}</Text>
                            </Pressable>
                            <Pressable
                              accessibilityLabel={`View ${reaction.count} ${reaction.emoji} reactions`}
                              accessibilityRole="button"
                              onPress={() =>
                                setReactionViewer({
                                  messageId: item.id,
                                  emoji: reaction.emoji,
                                })
                              }
                              style={styles.reactionSegment}
                            >
                              <Text style={{ color: theme.text }}>
                                {reaction.count}
                              </Text>
                            </Pressable>
                          </View>
                        ))}
                      </View>
                      {item.id === latestOutgoing?.id ? (
                        <Pressable
                          accessibilityRole={
                            conversation.data?.type ===
                              ConversationType.CHANNEL &&
                            (readerSummary.data?.readByCount ?? 0) > 0
                              ? "button"
                              : undefined
                          }
                          onPress={() =>
                            conversation.data?.type ===
                              ConversationType.CHANNEL &&
                            (readerSummary.data?.readByCount ?? 0) > 0
                              ? setShowReaders(true)
                              : undefined
                          }
                          style={{
                            alignSelf: "flex-end",
                          }}
                        >
                          <Text style={{ color: theme.muted, fontSize: 12 }}>
                            {conversation.data?.type === ConversationType.DIRECT
                              ? hasReadMessage(
                                  conversation.data.peerReadReceipt,
                                  item.id,
                                )
                                ? "Read"
                                : "Sent"
                              : (readerSummary.data?.readByCount ?? 0) > 0
                                ? `Read by ${readerSummary.data?.readByCount}`
                                : "Sent"}
                          </Text>
                        </Pressable>
                      ) : null}
                    </>
                  )}
                </View>
              </Pressable>
            );
          }}
        />
        {showJump ? (
          <Pressable
            accessibilityLabel="Jump to latest message"
            onPress={() =>
              listRef.current?.scrollToOffset({ offset: 0, animated: true })
            }
            style={[styles.jump, { backgroundColor: theme.accent }]}
          >
            <ArrowDown color="#ffffff" size={20} />
          </Pressable>
        ) : null}
      </View>
      <MessageActionSheet
        currentReaction={selectedMessage?.currentUserReaction ?? null}
        isOwnMessage={selectedMessage?.senderId === user?.id}
        onClose={() => setSelectedMessageId(null)}
        onDelete={() => {
          if (!selectedMessage) return;
          setSelectedMessageId(null);
          void messagesApi
            .remove(selectedMessage.id)
            .then(() => messages.refetch());
        }}
        onEdit={() => {
          if (selectedMessage) startEditing(selectedMessage);
        }}
        onReact={async (emoji) => {
          if (
            selectedMessage &&
            (await mutateReaction(selectedMessage, emoji))
          ) {
            setSelectedMessageId(null);
          }
        }}
        pending={reactionPendingMessageId === selectedMessage?.id}
        visible={Boolean(selectedMessage)}
      />
      <Modal
        animationType="fade"
        onRequestClose={() => setReactionViewer(null)}
        transparent
        visible={Boolean(reactionViewer)}
      >
        <View style={styles.modalBackdrop}>
          <View
            style={[
              styles.modalCard,
              { backgroundColor: theme.panel, borderColor: theme.border },
            ]}
          >
            <Text style={[styles.modalTitle, { color: theme.text }]}>
              {reactionViewer?.emoji} Reactions
            </Text>
            {reactionUsers.data?.pages
              .flatMap((page) => page.users)
              .map((reactor) => (
                <View key={reactor.id} style={styles.identityRow}>
                  <UserAvatar
                    assetId={reactor.avatarAssetId}
                    displayName={reactor.displayName}
                    externalUrl={reactor.avatarUrl}
                    size={38}
                  />
                  <Text style={{ color: theme.text, fontWeight: "800" }}>
                    {reactor.displayName}
                  </Text>
                </View>
              ))}
            {reactionUsers.hasNextPage ? (
              <Button
                disabled={reactionUsers.isFetchingNextPage}
                onPress={() => void reactionUsers.fetchNextPage()}
                variant="secondary"
              >
                {reactionUsers.isFetchingNextPage ? "Loading..." : "Load more"}
              </Button>
            ) : null}
            <Button onPress={() => setReactionViewer(null)} variant="ghost">
              Close
            </Button>
          </View>
        </View>
      </Modal>
      <Modal
        animationType="fade"
        onRequestClose={() => setShowReaders(false)}
        transparent
        visible={showReaders}
      >
        <View style={styles.modalBackdrop}>
          <View
            style={[
              styles.modalCard,
              { backgroundColor: theme.panel, borderColor: theme.border },
            ]}
          >
            <Text style={[styles.modalTitle, { color: theme.text }]}>
              Read by {readerSummary.data?.readByCount ?? 0}
            </Text>
            {readerSummary.data?.readers.map((reader) => (
              <View key={reader.id} style={styles.identityRow}>
                <UserAvatar
                  assetId={reader.avatarAssetId}
                  displayName={reader.displayName}
                  externalUrl={reader.avatarUrl}
                  size={38}
                />
                <Text style={{ color: theme.text, fontWeight: "800" }}>
                  {reader.displayName}
                </Text>
              </View>
            ))}
            {(readerSummary.data?.readByCount ?? 0) >
            (readerSummary.data?.readers.length ?? 0) ? (
              <Muted>
                +
                {(readerSummary.data?.readByCount ?? 0) -
                  (readerSummary.data?.readers.length ?? 0)}{" "}
                more
              </Muted>
            ) : null}
            <Button onPress={() => setShowReaders(false)} variant="ghost">
              Close
            </Button>
          </View>
        </View>
      </Modal>
      <View style={[styles.typing, { backgroundColor: theme.panel }]}>
        <Text style={{ color: theme.muted }}>
          {typingNames.length
            ? `${typingNames.slice(0, 2).join(" and ")} ${typingNames.length === 1 ? "is" : "are"} typing...`
            : " "}
        </Text>
      </View>
      {files.length ? (
        <View style={[styles.files, { backgroundColor: theme.panelStrong }]}>
          <View style={styles.fileList}>
            {files.map((file, index) => (
              <View key={`${file.uri}:${index}`} style={styles.fileRow}>
                <Text
                  numberOfLines={1}
                  style={[styles.fileName, { color: theme.text }]}
                >
                  {file.fileName}
                </Text>
                <Muted>
                  {send.isPending && uploadingFileIndex === index
                    ? `${Math.round((uploadProgress * files.length - index) * 100)}%`
                    : `${Math.max(1, Math.round(file.size / 1024))} KB`}
                </Muted>
              </View>
            ))}
          </View>
          <Button onPress={() => void clearAttachments()} variant="ghost">
            {send.isPending ? "Cancel upload" : "Clear"}
          </Button>
        </View>
      ) : null}
      {send.isError ? (
        <View style={[styles.files, { backgroundColor: theme.panelStrong }]}>
          <Text
            accessibilityLiveRegion="polite"
            style={{ color: theme.danger }}
          >
            {send.error instanceof Error
              ? send.error.message
              : "Message could not be sent"}
          </Text>
          {completedUploadIds.length ? (
            <Muted>
              Uploaded files are ready. Retry without uploading again.
            </Muted>
          ) : null}
        </View>
      ) : null}
      {editingMessageId ? (
        <View style={[styles.files, { backgroundColor: theme.panelStrong }]}>
          <Text style={{ color: theme.text }}>Editing message</Text>
          <Button
            onPress={() => {
              setEditingMessageId(null);
              setEditingAllowsEmpty(false);
              setContent("");
            }}
            variant="ghost"
          >
            Cancel
          </Button>
        </View>
      ) : null}
      <View
        style={[
          styles.composer,
          { borderTopColor: theme.border, backgroundColor: theme.panel },
        ]}
      >
        <Pressable
          disabled={Boolean(editingMessageId)}
          accessibilityLabel="Choose photos"
          onPress={() => void pickImages()}
        >
          <ImagePlus color={theme.muted} size={23} />
        </Pressable>
        <Pressable
          disabled={Boolean(editingMessageId)}
          accessibilityLabel="Choose files"
          onPress={() => void pickDocuments()}
        >
          <Paperclip color={theme.muted} size={23} />
        </Pressable>
        <TextInput
          accessibilityLabel="Message"
          maxLength={4000}
          multiline
          onBlur={() => stopTyping(conversationId)}
          onChangeText={setContent}
          placeholder={`Message ${title}`}
          placeholderTextColor={theme.muted}
          style={[
            styles.input,
            { color: theme.text, backgroundColor: theme.panelStrong },
          ]}
          value={content}
        />
        <Pressable
          accessibilityLabel="Send message"
          disabled={
            send.isPending ||
            (!content.trim() && !files.length && !editingAllowsEmpty)
          }
          onPress={() => send.mutate()}
          style={[styles.send, { backgroundColor: theme.accent }]}
        >
          <Send color="#ffffff" size={20} />
        </Pressable>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    padding: 16,
    borderBottomWidth: 1,
  },
  title: { fontSize: 18, fontWeight: "900" },
  contextBanner: {
    alignItems: "center",
    borderBottomWidth: 1,
    flexDirection: "row",
    gap: 8,
    justifyContent: "space-between",
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  contextText: { flex: 1, fontSize: 13, fontWeight: "700" },
  history: { flex: 1 },
  messages: { padding: 14, gap: 9 },
  messageRow: { alignItems: "flex-start" },
  mine: { alignItems: "flex-end" },
  bubble: {
    maxWidth: "86%",
    borderRadius: 18,
    borderWidth: 1,
    padding: 12,
    gap: 8,
  },
  reactions: { flexDirection: "row", flexWrap: "wrap", gap: 5 },
  reaction: {
    minHeight: 30,
    minWidth: 34,
    borderRadius: 15,
    paddingHorizontal: 3,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },
  reactionSegment: {
    minHeight: 30,
    minWidth: 30,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 5,
  },
  jump: {
    position: "absolute",
    right: 18,
    bottom: 16,
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
  },
  typing: { minHeight: 28, paddingHorizontal: 16, justifyContent: "center" },
  files: {
    padding: 10,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  fileList: { flex: 1, gap: 4 },
  fileRow: { alignItems: "center", flexDirection: "row", gap: 8 },
  fileName: { flex: 1, fontSize: 13, fontWeight: "700" },
  composer: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 10,
    borderTopWidth: 1,
    padding: 10,
  },
  input: {
    flex: 1,
    maxHeight: 120,
    minHeight: 44,
    borderRadius: 16,
    paddingHorizontal: 13,
    paddingVertical: 11,
  },
  send: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.68)",
    justifyContent: "center",
    padding: 24,
  },
  modalCard: {
    maxHeight: "78%",
    borderRadius: 22,
    borderWidth: 1,
    padding: 18,
    gap: 12,
  },
  modalTitle: { fontSize: 20, fontWeight: "900" },
  identityRow: { flexDirection: "row", alignItems: "center", gap: 11 },
});
