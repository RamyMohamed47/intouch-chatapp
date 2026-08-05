"use client";

import {
  CheckCheck,
  Hash,
  Lock,
  MessageCircle,
  Pencil,
  Send,
  Trash2,
  Users,
} from "lucide-react";
import { useEffect, useState, type SubmitEvent } from "react";
import {
  useMutation,
  useQueryClient,
  type InfiniteData,
} from "@tanstack/react-query";
import {
  createMessageSchema,
  updateMessageSchema,
  type MessageDto,
  type MessageListResponse,
} from "@intouch/shared/messages";

import { PageHeader } from "@/components/workspace/page-header";
import { ResourceState } from "@/components/workspace/resource-state";
import { initials } from "@/components/workspace/app-shell";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { FormError } from "@/components/ui/form-error";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/lib/auth/provider";
import { messagesApi } from "@/lib/api/messages";
import {
  useConversation,
  useMembers,
  useMessages,
  useOrganization,
} from "@/lib/query/hooks";
import { queryKeys } from "@/lib/query/keys";
import { useRealtime } from "@/lib/realtime/provider";

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
  const messages = useMessages(conversationId);
  const members = useMembers(organizationId, Boolean(conversation.data));
  const [content, setContent] = useState("");
  const [focused, setFocused] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingContent, setEditingContent] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [documentActive, setDocumentActive] = useState(
    () =>
      typeof document === "undefined" || document.visibilityState === "visible",
  );
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

  const allMessages = (
    messages.data?.pages.flatMap((page) => page.messages) ?? []
  )
    .filter(
      (message, index, list) =>
        list.findIndex((item) => item.id === message.id) === index,
    )
    .sort((left, right) => left.createdAt.localeCompare(right.createdAt));
  const newestMessage = allMessages.at(-1);
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
      setDocumentActive(document.visibilityState === "visible");
    document.addEventListener("visibilitychange", updateVisibility);
    return () =>
      document.removeEventListener("visibilitychange", updateVisibility);
  }, []);

  useEffect(() => {
    if (
      !newestMessage ||
      !documentActive ||
      conversation.data?.readReceipt?.lastReadMessageId === newestMessage.id ||
      receipt.isPending
    ) {
      return;
    }
    receipt.mutate(newestMessage.id);
  }, [
    conversation.data?.readReceipt?.lastReadMessageId,
    documentActive,
    newestMessage,
    receipt,
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
      void refreshSummaries();
    },
  });
  const deleteMessage = useMutation({
    mutationFn: (messageId: string) => messagesApi.remove(messageId),
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: queryKeys.conversations.messages(conversationId),
      });
      await refreshSummaries();
    },
  });

  const submit = (event: SubmitEvent<HTMLFormElement>) => {
    event.preventDefault();
    const parsed = createMessageSchema.safeParse({ content });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Message is invalid");
      return;
    }
    setError(null);
    sendMessage.mutate(parsed.data.content, {
      onError: (requestError) => setError(requestError.message),
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
  const typingNames = realtime
    .typingUserIds(conversationId)
    .map(
      (userId) =>
        members.data?.find((member) => member.user.id === userId)?.user
          .displayName,
    )
    .filter((name): name is string => Boolean(name));

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
          conversation.data.type === "CHANNEL"
            ? `A channel in ${organization.data.name}`
            : `Private conversation in ${organization.data.name}`
        }
        actions={
          <Badge variant="outline" className="rounded-full">
            {connected ? "Live" : "Reconnecting"}
          </Badge>
        }
      />
      <div className="flex min-h-0 flex-1 flex-col">
        <ScrollArea className="min-h-0 flex-1">
          <div className="mx-auto max-w-4xl p-5 md:p-8">
            {messages.hasNextPage && (
              <div className="mb-6 text-center">
                <Button
                  type="button"
                  variant="outline"
                  className="rounded-full"
                  disabled={messages.isFetchingNextPage}
                  onClick={() => void messages.fetchNextPage()}
                >
                  {messages.isFetchingNextPage
                    ? "Loading..."
                    : "Load earlier messages"}
                </Button>
              </div>
            )}
            {messages.isPending && (
              <p className="text-center text-sm text-muted-foreground">
                Loading messages...
              </p>
            )}
            {messages.isError && (
              <button
                type="button"
                onClick={() => void messages.refetch()}
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
                  own ||
                  (conversation.data.type === "CHANNEL" &&
                    organization.data.currentUserRole === "OWNER");
                return (
                  <article key={message.id} className="group flex gap-3">
                    <Avatar>
                      <AvatarFallback>
                        {initials(sender?.displayName ?? "User")}
                      </AvatarFallback>
                    </Avatar>
                    <div className="min-w-0 flex-1 rounded-2xl border border-border bg-background/30 p-4">
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
                              onClick={() => deleteMessage.mutate(message.id)}
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
                      {own &&
                        conversation.data.type === "DIRECT" &&
                        message.id === newestMessage?.id && (
                          <p className="mt-2 flex items-center gap-1 text-[10px] text-muted-foreground">
                            <CheckCheck className="size-3" />{" "}
                            {realtime.readReceipt(conversationId)
                              ?.lastReadMessageId === message.id
                              ? "Read"
                              : "Sent"}
                          </p>
                        )}
                    </div>
                  </article>
                );
              })}
              {!messages.isPending && allMessages.length === 0 && (
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
            </div>
          </div>
        </ScrollArea>

        <div className="shrink-0 border-t border-border bg-card/80 p-4">
          <form onSubmit={submit} className="mx-auto max-w-4xl">
            {typingNames.length > 0 && (
              <p className="mb-2 text-xs text-muted-foreground">
                {typingNames.join(", ")}{" "}
                {typingNames.length === 1 ? "is" : "are"} typing...
              </p>
            )}
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
                value={content}
                onChange={(event) => setContent(event.target.value)}
                onFocus={() => setFocused(true)}
                onBlur={() => setFocused(false)}
                placeholder={`Message ${title}`}
                className="min-h-10 resize-none border-0 bg-transparent shadow-none focus-visible:ring-0"
                maxLength={4000}
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
    </>
  );
}
