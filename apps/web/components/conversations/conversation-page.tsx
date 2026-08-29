"use client";

import {
  Check,
  CheckCheck,
  Hash,
  Lock,
  MessageCircle,
  Pencil,
  Send,
  Trash2,
  Users,
} from "lucide-react";
import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type SubmitEvent,
} from "react";
import {
  useMutation,
  useQueryClient,
  type InfiniteData,
} from "@tanstack/react-query";
import { useRouter, useSearchParams } from "next/navigation";
import {
  createMessageSchema,
  updateMessageSchema,
  type MessageDto,
  type MessageListResponse,
  type MessageReadReceiptSummaryDto,
} from "@intouch/shared/messages";
import {
  ChatWallpaperId,
  ChatWallpaperSource,
} from "@intouch/shared/chat-wallpapers";

import { PageHeader } from "@/components/workspace/page-header";
import { ResourceState } from "@/components/workspace/resource-state";
import { initials } from "@/components/workspace/app-shell";
import { InviteMemberDialog } from "@/components/memberships/invite-member-dialog";
import {
  isNearConversationBottom,
  insertEmojiAtSelection,
  restoredScrollTop,
  shouldSendMessageFromKey,
} from "@/components/conversations/conversation-interactions";
import { TypingIndicator } from "@/components/conversations/typing-indicator";
import { ChatWallpaperSurface } from "@/components/conversations/chat-wallpaper";
import { ChatWallpaperDialog } from "@/components/conversations/chat-wallpaper-dialog";
import { ComposerEmojiPicker } from "@/components/conversations/composer-emoji-picker";
import {
  MessageReactionPicker,
  MessageReactionSummaries,
} from "@/components/conversations/message-reactions";
import { PresenceIndicator } from "@/components/presence/presence-indicator";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { FormError } from "@/components/ui/form-error";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverDescription,
  PopoverHeader,
  PopoverTitle,
  PopoverTrigger,
} from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/lib/auth/provider";
import { messagesApi } from "@/lib/api/messages";
import {
  useConversation,
  useChatWallpaper,
  useMembers,
  useMessageReaders,
  useMessageContext,
  useMessages,
  useOrganization,
} from "@/lib/query/hooks";
import { queryKeys } from "@/lib/query/keys";
import { useRealtime } from "@/lib/realtime/provider";
import { hasReadMessage } from "@/lib/realtime/read-receipt-cache";
import { mergeReactionState } from "@/lib/reactions/message-reaction-cache";
import { cn } from "@/lib/utils";

const formatTime = (value: string) =>
  new Intl.DateTimeFormat(undefined, {
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));

const upsertCachedMessage = (
  data: InfiniteData<MessageListResponse> | undefined,
  message: MessageDto,
) => {
  if (!data) return data;
  let found = false;
  const pages = data.pages.map((page) => ({
    ...page,
    messages: page.messages.map((current) => {
      if (current.id !== message.id) return current;
      found = true;
      return message;
    }),
  }));
  if (!found && pages[0])
    pages[0] = { ...pages[0], messages: [message, ...pages[0].messages] };
  return { ...data, pages };
};

function ChannelReadReceiptStatus({
  summary,
}: {
  summary: MessageReadReceiptSummaryDto | undefined;
}) {
  if (!summary || summary.readByCount === 0) {
    return (
      <p
        className="mt-2 flex items-center gap-1 text-[10px] text-muted-foreground"
        role="status"
        aria-live="polite"
        aria-label="Message sent"
      >
        <Check className="size-3" aria-hidden />
        Sent
      </p>
    );
  }

  const remainingReaders = Math.max(
    0,
    summary.readByCount - summary.readers.length,
  );
  return (
    <Popover>
      <PopoverTrigger
        className="mt-2 inline-flex items-center gap-1 rounded-md text-[10px] text-muted-foreground outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
        aria-label={`Read by ${summary.readByCount} members`}
      >
        <CheckCheck className="size-3" aria-hidden />
        Read by {summary.readByCount}
      </PopoverTrigger>
      <PopoverContent align="start" className="w-64">
        <PopoverHeader>
          <PopoverTitle>Read by</PopoverTitle>
          <PopoverDescription>
            Members who reached this message.
          </PopoverDescription>
        </PopoverHeader>
        <div className="grid gap-2">
          {summary.readers.map((reader) => (
            <div key={reader.id} className="flex items-center gap-2">
              <Avatar className="size-7">
                <AvatarFallback className="text-[10px]">
                  {initials(reader.displayName)}
                </AvatarFallback>
              </Avatar>
              <span className="min-w-0 truncate text-sm">
                {reader.displayName}
              </span>
            </div>
          ))}
          {remainingReaders > 0 && (
            <p className="text-xs text-muted-foreground">
              And {remainingReaders} other{remainingReaders === 1 ? "" : "s"}
            </p>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}

export function ConversationPage({
  organizationId,
  conversationId,
  expectedType,
}: {
  organizationId: string;
  conversationId: string;
  expectedType: "CHANNEL" | "DIRECT";
}) {
  const queryClient = useQueryClient();
  const router = useRouter();
  const searchParams = useSearchParams();
  const anchorMessageId = searchParams.get("messageId") ?? "";
  const { user } = useAuth();
  const realtime = useRealtime();
  const {
    connected,
    joinConversation,
    leaveConversation,
    startTyping,
    stopTyping,
  } = realtime;
  const organization = useOrganization(organizationId);
  const conversation = useConversation(conversationId);
  const chatWallpaper = useChatWallpaper(conversationId);
  const messages = useMessages(conversationId, !anchorMessageId);
  const messageContext = useMessageContext(conversationId, anchorMessageId);
  const members = useMembers(organizationId);
  const [content, setContent] = useState("");
  const [focused, setFocused] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingContent, setEditingContent] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<MessageDto | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [highlightedMessageId, setHighlightedMessageId] = useState<
    string | null
  >(null);
  const messageEndRef = useRef<HTMLDivElement>(null);
  const messageViewportRef = useRef<HTMLDivElement>(null);
  const composerRef = useRef<HTMLTextAreaElement>(null);
  const isNearBottomRef = useRef(true);
  const failedReceiptMessageIdRef = useRef<string | null>(null);
  const pendingReceiptMessageIdRef = useRef<string | null>(null);
  const forceBottomScrollRef = useRef(false);
  const scrollStateRef = useRef<{
    conversationId: string;
    initialized: boolean;
    newestMessageId: string | null;
  }>({ conversationId, initialized: false, newestMessageId: null });
  const [newestMessageVisible, setNewestMessageVisible] = useState(true);
  const [documentActive, setDocumentActive] = useState(
    () =>
      typeof document === "undefined" ||
      (document.visibilityState === "visible" && document.hasFocus()),
  );
  const activeWallpaper = chatWallpaper.data ?? {
    wallpaperId: ChatWallpaperId.INTOUCH_DOODLE,
    dimming: 35,
    source: ChatWallpaperSource.DEFAULT,
  };
  const refreshSummaries = () =>
    Promise.all([
      queryClient.invalidateQueries({
        queryKey: queryKeys.conversations.channels(organizationId),
      }),
      queryClient.invalidateQueries({
        queryKey: queryKeys.conversations.directMessages(organizationId),
      }),
      queryClient.invalidateQueries({
        queryKey: queryKeys.conversations.directMessagePreview(organizationId),
      }),
    ]);

  useEffect(() => {
    if (!connected) return;
    void joinConversation(conversationId);
    return () => {
      stopTyping(conversationId);
      void leaveConversation(conversationId);
    };
  }, [
    connected,
    conversationId,
    joinConversation,
    leaveConversation,
    stopTyping,
  ]);

  useEffect(() => {
    if (!focused || !content.trim()) {
      stopTyping(conversationId);
      return;
    }
    startTyping(conversationId);
    const timer = window.setInterval(() => startTyping(conversationId), 3_000);
    return () => {
      window.clearInterval(timer);
      stopTyping(conversationId);
    };
  }, [content, conversationId, focused, startTyping, stopTyping]);

  const sourceMessages = anchorMessageId
    ? (messageContext.data?.messages ?? [])
    : (messages.data?.pages.flatMap((page) => page.messages) ?? []);
  const allMessages = sourceMessages
    .filter(
      (message, index, list) =>
        list.findIndex((item) => item.id === message.id) === index,
    )
    .sort((left, right) => left.createdAt.localeCompare(right.createdAt));
  const newestMessage = allMessages.at(-1);
  const latestOutgoingMessage = allMessages.findLast(
    (message) => message.senderId === user?.id && !message.deletedAt,
  );
  const channelReaderMessageId =
    conversation.data?.type === "CHANNEL" ? latestOutgoingMessage?.id : "";
  const channelReaders = useMessageReaders(
    conversationId,
    channelReaderMessageId ?? "",
    Boolean(channelReaderMessageId),
  );
  const messageDataPending = anchorMessageId
    ? messageContext.isPending
    : messages.isPending;
  const messageDataError = anchorMessageId
    ? messageContext.isError
    : messages.isError;
  const atLatestMessage =
    !anchorMessageId || messageContext.data?.hasLater === false;

  useLayoutEffect(() => {
    if (scrollStateRef.current.conversationId !== conversationId) {
      scrollStateRef.current = {
        conversationId,
        initialized: false,
        newestMessageId: null,
      };
      isNearBottomRef.current = true;
      failedReceiptMessageIdRef.current = null;
      pendingReceiptMessageIdRef.current = null;
      setNewestMessageVisible(true);
      forceBottomScrollRef.current = false;
    }

    if (messageDataPending) return;

    const viewport = messageViewportRef.current;
    if (!viewport) return;

    const newestMessageId = newestMessage?.id ?? null;
    if (!scrollStateRef.current.initialized) {
      if (!anchorMessageId) viewport.scrollTop = viewport.scrollHeight;
      scrollStateRef.current.initialized = true;
      scrollStateRef.current.newestMessageId = newestMessageId;
      isNearBottomRef.current = !anchorMessageId;
      setNewestMessageVisible(!anchorMessageId);
      return;
    }

    if (scrollStateRef.current.newestMessageId === newestMessageId) return;

    scrollStateRef.current.newestMessageId = newestMessageId;
    const shouldScroll =
      forceBottomScrollRef.current || isNearBottomRef.current;
    forceBottomScrollRef.current = false;
    if (shouldScroll) {
      messageEndRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "end",
      });
    }
  }, [anchorMessageId, conversationId, messageDataPending, newestMessage?.id]);

  useEffect(() => {
    if (!anchorMessageId || !messageContext.data) return;
    const frame = window.requestAnimationFrame(() => {
      document
        .getElementById(`message-${anchorMessageId}`)
        ?.scrollIntoView({ block: "center" });
      setHighlightedMessageId(anchorMessageId);
    });
    const timeout = window.setTimeout(
      () => setHighlightedMessageId(null),
      2_500,
    );
    return () => {
      window.cancelAnimationFrame(frame);
      window.clearTimeout(timeout);
    };
  }, [anchorMessageId, messageContext.data]);
  const receipt = useMutation({
    mutationFn: (messageId: string) =>
      messagesApi.updateReadReceipt(conversationId, { messageId }),
    onSuccess: (readReceipt) => {
      queryClient.setQueryData(
        queryKeys.conversations.detail(conversationId),
        (current: typeof conversation.data) =>
          current ? { ...current, readReceipt, unreadCount: 0 } : current,
      );
      void refreshSummaries();
    },
  });

  useEffect(() => {
    const updateVisibility = () =>
      setDocumentActive(
        document.visibilityState === "visible" && document.hasFocus(),
      );
    document.addEventListener("visibilitychange", updateVisibility);
    window.addEventListener("focus", updateVisibility);
    window.addEventListener("blur", updateVisibility);
    return () => {
      document.removeEventListener("visibilitychange", updateVisibility);
      window.removeEventListener("focus", updateVisibility);
      window.removeEventListener("blur", updateVisibility);
    };
  }, []);

  useEffect(() => {
    if (!documentActive || !newestMessageVisible) {
      failedReceiptMessageIdRef.current = null;
    }
  }, [documentActive, newestMessageVisible]);

  useEffect(() => {
    if (
      !newestMessage ||
      !atLatestMessage ||
      !documentActive ||
      !newestMessageVisible ||
      hasReadMessage(conversation.data?.readReceipt, newestMessage.id) ||
      failedReceiptMessageIdRef.current === newestMessage.id ||
      pendingReceiptMessageIdRef.current === newestMessage.id
    ) {
      return;
    }
    pendingReceiptMessageIdRef.current = newestMessage.id;
    receipt.mutate(newestMessage.id, {
      onError: () => {
        failedReceiptMessageIdRef.current = newestMessage.id;
      },
      onSuccess: () => {
        failedReceiptMessageIdRef.current = null;
      },
      onSettled: () => {
        if (pendingReceiptMessageIdRef.current === newestMessage.id) {
          pendingReceiptMessageIdRef.current = null;
        }
      },
    });
  }, [
    conversation.data?.readReceipt?.lastReadMessageId,
    documentActive,
    newestMessage,
    newestMessageVisible,
    receipt,
    atLatestMessage,
  ]);

  const sendMessage = useMutation({
    mutationFn: (messageContent: string) =>
      messagesApi.create(conversationId, { content: messageContent }),
    onSuccess: (message) => {
      queryClient.setQueryData<InfiniteData<MessageListResponse>>(
        queryKeys.conversations.messages(conversationId),
        (current) => upsertCachedMessage(current, message),
      );
      setContent("");
      stopTyping(conversationId);
      if (anchorMessageId) {
        const segment =
          expectedType === "CHANNEL" ? "channels" : "direct-messages";
        router.replace(`/app/${organizationId}/${segment}/${conversationId}`);
      }
      void refreshSummaries();
    },
  });
  const editMessage = useMutation({
    mutationFn: ({
      messageId,
      messageContent,
    }: {
      messageId: string;
      messageContent: string;
    }) => messagesApi.update(messageId, { content: messageContent }),
    onSuccess: (message) => {
      queryClient.setQueryData<InfiniteData<MessageListResponse>>(
        queryKeys.conversations.messages(conversationId),
        (current) => upsertCachedMessage(current, message),
      );
      setEditingId(null);
      void queryClient.invalidateQueries({
        queryKey: queryKeys.conversations.messageContext(
          conversationId,
          anchorMessageId,
        ),
      });
      void refreshSummaries();
    },
  });
  const deleteMessage = useMutation({
    mutationFn: (messageId: string) => messagesApi.remove(messageId),
    onSuccess: async () => {
      setDeleteTarget(null);
      await queryClient.invalidateQueries({
        queryKey: queryKeys.conversations.messages(conversationId),
      });
      await refreshSummaries();
    },
  });
  const mutateReaction = useMutation({
    mutationFn: ({
      emoji,
      messageId,
      remove,
    }: {
      emoji: string;
      messageId: string;
      remove: boolean;
    }) =>
      remove
        ? messagesApi.removeReaction(messageId)
        : messagesApi.setReaction(messageId, { emoji }),
    onSuccess: (state) => {
      queryClient.setQueryData<InfiniteData<MessageListResponse>>(
        queryKeys.conversations.messages(conversationId),
        (current) => mergeReactionState(current, state),
      );
      void queryClient.invalidateQueries({
        predicate: (query) =>
          query.queryKey[0] === "messages" &&
          query.queryKey[1] === state.messageId &&
          query.queryKey[2] === "reaction-users",
      });
      if (anchorMessageId) {
        void queryClient.invalidateQueries({
          queryKey: queryKeys.conversations.messageContext(
            conversationId,
            anchorMessageId,
          ),
        });
      }
      setError(null);
    },
    onError: (requestError) => setError(requestError.message),
  });

  const insertEmoji = (emoji: string) => {
    const textarea = composerRef.current;
    const start = textarea?.selectionStart ?? content.length;
    const end = textarea?.selectionEnd ?? content.length;
    const insertion = insertEmojiAtSelection({ content, emoji, start, end });
    if (!insertion) {
      setError("Message cannot exceed 4,000 characters");
      return;
    }
    setContent(insertion.content);
    setError(null);
    window.requestAnimationFrame(() => {
      composerRef.current?.focus();
      composerRef.current?.setSelectionRange(insertion.caret, insertion.caret);
    });
  };

  const submit = (event: SubmitEvent<HTMLFormElement>) => {
    event.preventDefault();
    const parsed = createMessageSchema.safeParse({ content });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Message is invalid");
      return;
    }
    setError(null);
    forceBottomScrollRef.current = true;
    sendMessage.mutate(parsed.data.content, {
      onError: (requestError) => {
        forceBottomScrollRef.current = false;
        setError(requestError.message);
      },
    });
  };

  const loadEarlierMessages = async () => {
    const viewport = messageViewportRef.current;
    const previousHeight = viewport?.scrollHeight ?? 0;
    const previousTop = viewport?.scrollTop ?? 0;

    await messages.fetchNextPage();
    window.requestAnimationFrame(() => {
      const currentViewport = messageViewportRef.current;
      if (!currentViewport) return;
      currentViewport.scrollTop = restoredScrollTop({
        previousHeight,
        previousTop,
        currentHeight: currentViewport.scrollHeight,
      });
    });
  };

  if (realtime.revokedConversationId === conversationId) {
    return (
      <ResourceState
        title="Conversation access changed"
        description="Your access to this conversation was revoked."
        href={`/app/${organizationId}`}
      />
    );
  }
  if (conversation.isPending || organization.isPending) {
    return (
      <ResourceState
        title="Loading conversation"
        description="Fetching the conversation and recent messages."
      />
    );
  }
  if (
    conversation.isError ||
    organization.isError ||
    !conversation.data ||
    !organization.data ||
    conversation.data.organizationId !== organizationId ||
    conversation.data.type !== expectedType
  ) {
    return (
      <ResourceState
        title="Conversation not found"
        description="This conversation is unavailable or you no longer have access."
        href={`/app/${organizationId}`}
      />
    );
  }

  const title =
    conversation.data.type === "CHANNEL"
      ? conversation.data.name
      : conversation.data.peer.displayName;
  const directMessagePeerId =
    conversation.data.type === "DIRECT" ? conversation.data.peer.id : undefined;
  const directMessagePeer = directMessagePeerId
    ? members.data?.find((member) => member.user.id === directMessagePeerId)
        ?.user
    : undefined;
  const typingNames = realtime
    .typingUserIds(conversationId)
    .filter((typingUserId) => typingUserId !== user?.id)
    .map(
      (userId) =>
        members.data?.find((member) => member.user.id === userId)?.user
          .displayName,
    );
  const latestOutgoingRead = latestOutgoingMessage
    ? hasReadMessage(
        conversation.data.type === "DIRECT"
          ? conversation.data.peerReadReceipt
          : null,
        latestOutgoingMessage.id,
      )
    : false;

  return (
    <>
      <PageHeader
        eyebrow={
          conversation.data.type === "CHANNEL"
            ? `${conversation.data.visibility.toLowerCase()} channel`
            : "Direct message"
        }
        title={title}
        description={
          conversation.data.type === "CHANNEL" ? (
            `A channel in ${organization.data.name}`
          ) : (
            <span className="inline-flex min-w-0 items-center gap-2">
              <span className="truncate">
                Private conversation in {organization.data.name}
              </span>
              {directMessagePeer && (
                <>
                  <span aria-hidden="true">-</span>
                  <PresenceIndicator
                    className="shrink-0"
                    displayName={directMessagePeer.displayName}
                    status={directMessagePeer.status}
                    lastSeenAt={directMessagePeer.lastSeenAt}
                  />
                </>
              )}
            </span>
          )
        }
        actions={
          <>
            <ChatWallpaperDialog
              conversationId={conversationId}
              wallpaper={activeWallpaper}
            />
            {organization.data.currentUserRole === "OWNER" && (
              <InviteMemberDialog
                organizationId={organizationId}
                organizationName={organization.data.name}
              />
            )}
            <Badge variant="outline" className="rounded-full">
              {connected ? "Live" : "Reconnecting"}
            </Badge>
          </>
        }
      />
      <div className="flex min-h-0 flex-1 flex-col">
        <div className="relative min-h-0 flex-1 overflow-hidden">
          <ChatWallpaperSurface wallpaper={activeWallpaper} />
          <ScrollArea
            className="relative z-10 h-full bg-transparent"
            viewportRef={messageViewportRef}
            onViewportScroll={(event) => {
              const viewport = event.currentTarget;
              const nearBottom = isNearConversationBottom(viewport);
              isNearBottomRef.current = nearBottom;
              setNewestMessageVisible(
                atLatestMessage && isNearConversationBottom(viewport, 1),
              );
            }}
          >
            <div className="mx-auto max-w-4xl p-5 md:p-8">
              {anchorMessageId && (
                <div className="mb-6 flex flex-col items-center justify-between gap-3 rounded-2xl border border-primary/20 bg-primary/5 p-4 text-sm sm:flex-row">
                  <span className="text-muted-foreground">
                    Viewing a search result in its conversation context.
                  </span>
                  <Button
                    type="button"
                    variant="outline"
                    className="rounded-full"
                    onClick={() => {
                      const segment =
                        expectedType === "CHANNEL"
                          ? "channels"
                          : "direct-messages";
                      router.replace(
                        `/app/${organizationId}/${segment}/${conversationId}`,
                      );
                    }}
                  >
                    Jump to latest
                  </Button>
                </div>
              )}
              {!anchorMessageId && messages.hasNextPage && (
                <div className="mb-6 text-center">
                  <Button
                    type="button"
                    variant="outline"
                    className="rounded-full"
                    disabled={messages.isFetchingNextPage}
                    onClick={() => void loadEarlierMessages()}
                  >
                    {messages.isFetchingNextPage
                      ? "Loading..."
                      : "Load earlier messages"}
                  </Button>
                </div>
              )}
              {messageDataPending && (
                <p className="text-center text-sm text-muted-foreground">
                  Loading messages...
                </p>
              )}
              {messageDataError && (
                <button
                  type="button"
                  onClick={() =>
                    void (anchorMessageId
                      ? messageContext.refetch()
                      : messages.refetch())
                  }
                  className="w-full rounded-2xl border border-destructive/30 p-4 text-sm text-destructive"
                >
                  Messages could not be loaded. Select to retry.
                </button>
              )}
              <div className="grid gap-5">
                {allMessages.map((message) => {
                  const sender = members.data?.find(
                    (member) => member.user.id === message.senderId,
                  )?.user;
                  const own = message.senderId === user?.id;
                  const canDelete =
                    !message.deletedAt &&
                    (own ||
                      (conversation.data.type === "CHANNEL" &&
                        organization.data.currentUserRole === "OWNER"));
                  return (
                    <article
                      id={`message-${message.id}`}
                      key={message.id}
                      className={cn(
                        "group flex gap-3 rounded-2xl transition duration-700",
                        highlightedMessageId === message.id &&
                          "bg-brand-orange/10 ring-2 ring-brand-orange/40 ring-offset-4 ring-offset-background",
                      )}
                    >
                      <Avatar>
                        <AvatarFallback>
                          {initials(sender?.displayName ?? "User")}
                        </AvatarFallback>
                      </Avatar>
                      <div className="min-w-0 flex-1 rounded-2xl border border-border bg-card/82 p-4 shadow-sm backdrop-blur-md">
                        <div className="flex items-center gap-2">
                          <strong className="truncate text-sm">
                            {sender?.displayName ?? "Member"}
                          </strong>
                          <span className="font-mono text-[10px] text-muted-foreground">
                            {formatTime(message.createdAt)}
                          </span>
                          {message.editedAt && (
                            <span className="text-[10px] text-muted-foreground">
                              edited
                            </span>
                          )}
                          <div className="ml-auto flex gap-1 opacity-0 transition group-focus-within:opacity-100 group-hover:opacity-100">
                            {!message.deletedAt && (
                              <MessageReactionPicker
                                currentReaction={message.currentUserReaction}
                                disabled={
                                  mutateReaction.isPending &&
                                  mutateReaction.variables?.messageId ===
                                    message.id
                                }
                                onSelect={(emoji) =>
                                  mutateReaction.mutate({
                                    emoji,
                                    messageId: message.id,
                                    remove:
                                      message.currentUserReaction === emoji,
                                  })
                                }
                              />
                            )}
                            {own && !message.deletedAt && (
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon-xs"
                                aria-label="Edit message"
                                onClick={() => {
                                  setEditingId(message.id);
                                  setEditingContent(message.content ?? "");
                                }}
                              >
                                <Pencil />
                              </Button>
                            )}
                            {canDelete && (
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon-xs"
                                aria-label="Delete message"
                                disabled={deleteMessage.isPending}
                                onClick={() => {
                                  deleteMessage.reset();
                                  setDeleteTarget(message);
                                }}
                              >
                                <Trash2 />
                              </Button>
                            )}
                          </div>
                        </div>
                        {editingId === message.id ? (
                          <form
                            className="mt-2 flex gap-2"
                            onSubmit={(event) => {
                              event.preventDefault();
                              const parsed = updateMessageSchema.safeParse({
                                content: editingContent,
                              });
                              if (parsed.success) {
                                editMessage.mutate({
                                  messageId: message.id,
                                  messageContent: parsed.data.content,
                                });
                              }
                            }}
                          >
                            <Input
                              value={editingContent}
                              onChange={(event) =>
                                setEditingContent(event.target.value)
                              }
                            />
                            <Button
                              type="submit"
                              size="sm"
                              disabled={editMessage.isPending}
                            >
                              Save
                            </Button>
                          </form>
                        ) : (
                          <p
                            className={
                              message.deletedAt
                                ? "mt-2 text-sm italic text-muted-foreground"
                                : "mt-2 whitespace-pre-wrap text-sm leading-6"
                            }
                          >
                            {message.deletedAt
                              ? "Message deleted"
                              : message.content}
                          </p>
                        )}
                        <MessageReactionSummaries
                          message={message}
                          disabled={
                            mutateReaction.isPending &&
                            mutateReaction.variables?.messageId === message.id
                          }
                          onToggle={(emoji) =>
                            mutateReaction.mutate({
                              emoji,
                              messageId: message.id,
                              remove: message.currentUserReaction === emoji,
                            })
                          }
                        />
                        {own &&
                          conversation.data.type === "DIRECT" &&
                          message.id === latestOutgoingMessage?.id && (
                            <p
                              className="mt-2 flex items-center gap-1 text-[10px] text-muted-foreground"
                              role="status"
                              aria-live="polite"
                              aria-label={
                                latestOutgoingRead
                                  ? "Message read"
                                  : "Message sent"
                              }
                            >
                              {latestOutgoingRead ? (
                                <CheckCheck className="size-3" aria-hidden />
                              ) : (
                                <Check className="size-3" aria-hidden />
                              )}
                              {latestOutgoingRead ? "Read" : "Sent"}
                            </p>
                          )}
                        {own &&
                          conversation.data.type === "CHANNEL" &&
                          message.id === latestOutgoingMessage?.id && (
                            <ChannelReadReceiptStatus
                              summary={channelReaders.data}
                            />
                          )}
                      </div>
                    </article>
                  );
                })}
                {!messageDataPending && allMessages.length === 0 && (
                  <div className="py-16 text-center">
                    <span className="mx-auto grid size-14 place-items-center rounded-2xl bg-primary/10 text-primary">
                      {conversation.data.type === "CHANNEL" ? (
                        <Hash />
                      ) : (
                        <MessageCircle />
                      )}
                    </span>
                    <h2 className="mt-5 text-xl font-semibold">
                      Start the conversation
                    </h2>
                    <p className="mt-2 text-sm text-muted-foreground">
                      The first message sets the context.
                    </p>
                  </div>
                )}
                <div ref={messageEndRef} aria-hidden="true" />
              </div>
            </div>
          </ScrollArea>
        </div>

        <div className="shrink-0 border-t border-border bg-card/80 p-4">
          <form onSubmit={submit} className="mx-auto max-w-4xl">
            <TypingIndicator names={typingNames} />
            <div className="flex items-end gap-2 rounded-2xl border border-border bg-background/50 p-2 focus-within:border-primary/40">
              <span className="mb-2 grid size-8 place-items-center text-muted-foreground">
                {conversation.data.type === "CHANNEL" ? (
                  conversation.data.visibility === "PRIVATE" ? (
                    <Lock />
                  ) : (
                    <Hash />
                  )
                ) : (
                  <Users />
                )}
              </span>
              <Textarea
                ref={composerRef}
                value={content}
                onChange={(event) => setContent(event.target.value)}
                onFocus={() => setFocused(true)}
                onBlur={() => setFocused(false)}
                onKeyDown={(event) => {
                  if (
                    !shouldSendMessageFromKey({
                      key: event.key,
                      shiftKey: event.shiftKey,
                      isComposing: event.nativeEvent.isComposing,
                    })
                  ) {
                    return;
                  }

                  event.preventDefault();
                  if (!sendMessage.isPending && content.trim()) {
                    event.currentTarget.form?.requestSubmit();
                  }
                }}
                placeholder={`Message ${title}`}
                className="min-h-10 resize-none border-0 bg-transparent shadow-none focus-visible:ring-0"
                maxLength={4000}
              />
              <ComposerEmojiPicker
                disabled={sendMessage.isPending}
                onSelect={insertEmoji}
              />
              <Button
                type="submit"
                size="icon"
                aria-label="Send message"
                disabled={sendMessage.isPending || !content.trim()}
              >
                <Send />
              </Button>
            </div>
            {error && (
              <div className="mt-2">
                <FormError>{error}</FormError>
              </div>
            )}
          </form>
        </div>
      </div>
      <AlertDialog
        open={deleteTarget !== null}
        onOpenChange={(open) => {
          if (!open && !deleteMessage.isPending) {
            deleteMessage.reset();
            setDeleteTarget(null);
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this message?</AlertDialogTitle>
            <AlertDialogDescription>
              Its content will be replaced with a deletion notice for everyone.
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          {deleteMessage.isError && (
            <FormError className="mt-4">
              {deleteMessage.error.message}
            </FormError>
          )}
          <AlertDialogFooter>
            <Button
              type="button"
              variant="outline"
              disabled={deleteMessage.isPending}
              onClick={() => {
                deleteMessage.reset();
                setDeleteTarget(null);
              }}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              disabled={!deleteTarget || deleteMessage.isPending}
              onClick={() => {
                if (deleteTarget) deleteMessage.mutate(deleteTarget.id);
              }}
            >
              {deleteMessage.isPending ? "Deleting..." : "Delete message"}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
