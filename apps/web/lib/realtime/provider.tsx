"use client";

import { useQueryClient, type InfiniteData } from "@tanstack/react-query";
import type {
  ConversationDto,
  DirectMessageListResponse,
} from "@intouch/shared/conversations";
import {
  channelReadReceiptsChangedEventSchema,
  conversationActivityEventSchema,
  ConversationActivityKind,
  messageEventSchema,
  membershipJoinedEventSchema,
  presenceEventSchema,
  readReceiptEventSchema,
  socketAcknowledgementSchema,
  socketConnectionErrorSchema,
  typingEventSchema,
  type MessageEvent,
  type SocketAcknowledgementResult,
} from "@intouch/shared/realtime";
import type { OrganizationMemberDto } from "@intouch/shared/memberships";
import type { MessageListResponse } from "@intouch/shared/messages";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";

import {
  getAccessToken,
  subscribeToAccessToken,
} from "@/lib/auth/access-token";
import { useAuth } from "@/lib/auth/provider";
import { refreshAccessToken } from "@/lib/api/client";
import { queryKeys } from "@/lib/query/keys";
import {
  createRealtimeClient,
  type InTouchSocket,
} from "@/lib/realtime/client";
import { useTypingState } from "@/lib/realtime/use-typing-state";
import { useNotification } from "@/components/ui/toast";
import {
  mergePeerReadReceipt,
  mergePeerReceiptIntoDirectMessagePage,
  mergePeerReceiptIntoInfiniteDirectMessages,
} from "@/lib/realtime/read-receipt-cache";

interface RealtimeContextValue {
  connected: boolean;
  revokedConversationId: string | null;
  typingUserIds: (conversationId: string) => string[];
  subscribeOrganization: (
    organizationId: string,
  ) => Promise<SocketAcknowledgementResult>;
  unsubscribeOrganization: (
    organizationId: string,
  ) => Promise<SocketAcknowledgementResult>;
  joinConversation: (
    conversationId: string,
  ) => Promise<SocketAcknowledgementResult>;
  leaveConversation: (
    conversationId: string,
  ) => Promise<SocketAcknowledgementResult>;
  startTyping: (conversationId: string) => void;
  stopTyping: (conversationId: string) => void;
}

const RealtimeContext = createContext<RealtimeContextValue | null>(null);
const unavailable: SocketAcknowledgementResult = {
  success: false,
  error: {
    code: "REALTIME_UNAVAILABLE",
    message: "Realtime connection is unavailable",
  },
};

const emitAcknowledged = (
  socket: InTouchSocket | null,
  event:
    "conversation:join" | "conversation:leave" | "typing:start" | "typing:stop",
  conversationId: string,
) =>
  new Promise<SocketAcknowledgementResult>((resolve) => {
    if (!socket?.connected) {
      resolve(unavailable);
      return;
    }
    socket.emit(event, { conversationId }, (result) => {
      const parsed = socketAcknowledgementSchema.safeParse(result);
      resolve(parsed.success ? parsed.data : unavailable);
    });
  });

const emitOrganization = (
  socket: InTouchSocket | null,
  event: "organization:subscribe" | "organization:unsubscribe",
  organizationId: string,
) =>
  new Promise<SocketAcknowledgementResult>((resolve) => {
    if (!socket?.connected) {
      resolve(unavailable);
      return;
    }
    socket.emit(event, { organizationId }, (result) => {
      const parsed = socketAcknowledgementSchema.safeParse(result);
      resolve(parsed.success ? parsed.data : unavailable);
    });
  });

const upsertMessage = (
  data: InfiniteData<MessageListResponse> | undefined,
  message: MessageEvent,
  prepend: boolean,
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
  if (!found && prepend && pages[0]) {
    pages[0] = { ...pages[0], messages: [message, ...pages[0].messages] };
  }
  return { ...data, pages };
};

export function RealtimeProvider({
  children,
  socketFactory = createRealtimeClient,
}: {
  children: ReactNode;
  socketFactory?: () => InTouchSocket;
}) {
  const { status, user } = useAuth();
  const { notify } = useNotification();
  const queryClient = useQueryClient();
  const [socket, setSocket] = useState<InTouchSocket | null>(null);
  const [connected, setConnected] = useState(false);
  const [accessToken, setCurrentAccessToken] = useState(getAccessToken);
  const [revokedConversationId, setRevokedConversationId] = useState<
    string | null
  >(null);
  const joinedConversationIdsRef = useRef(new Set<string>());
  const {
    applyTypingUpdate,
    clearAllTyping,
    clearTypingConversation,
    typingUserIds,
  } = useTypingState(user?.id);

  useEffect(() => subscribeToAccessToken(setCurrentAccessToken), []);

  useEffect(() => {
    if (status !== "authenticated" || !accessToken) {
      joinedConversationIdsRef.current.clear();
      clearAllTyping();
      setSocket((current) => {
        current?.disconnect();
        return null;
      });
      setConnected(false);
      return;
    }

    const nextSocket = socketFactory();
    let refreshing = false;
    let reconnectTimer: ReturnType<typeof setTimeout> | undefined;
    const receiptInvalidationTimers = new Map<
      string,
      ReturnType<typeof setTimeout>
    >();
    const seenActivityIds = new Set<string>();
    const seenActivityQueue: string[] = [];
    nextSocket.on("connect", () => {
      if (reconnectTimer) clearTimeout(reconnectTimer);
      reconnectTimer = undefined;
      refreshing = false;
      clearAllTyping();
      joinedConversationIdsRef.current.clear();
      setConnected(true);
      void queryClient.invalidateQueries({
        predicate: (query) =>
          (query.queryKey[0] === "organizations" &&
            ["channels", "direct-messages", "direct-message-preview"].includes(
              String(query.queryKey[2]),
            )) ||
          (query.queryKey[0] === "conversations" &&
            query.queryKey.length === 2),
      });
    });
    nextSocket.on("disconnect", (reason) => {
      setConnected(false);
      clearAllTyping();
      joinedConversationIdsRef.current.clear();
      if (reason === "io server disconnect" && !refreshing) {
        refreshing = true;
        void refreshAccessToken();
      }
    });
    nextSocket.on("connect_error", (error) => {
      const parsed = socketConnectionErrorSchema.safeParse(
        (error as Error & { data?: unknown }).data,
      );
      if (!parsed.success) return;
      if (parsed.data.code === "UNAUTHORIZED") {
        if (refreshing) return;
        refreshing = true;
        void refreshAccessToken();
        return;
      }
      if (parsed.data.code === "TOO_MANY_REQUESTS") {
        if (reconnectTimer) clearTimeout(reconnectTimer);
        reconnectTimer = setTimeout(
          () => nextSocket.connect(),
          parsed.data.retryAfterMs ?? 15_000,
        );
      }
    });

    const handleMessage = (raw: MessageEvent, prepend: boolean) => {
      const parsed = messageEventSchema.safeParse(raw);
      if (!parsed.success) return;
      queryClient.setQueryData<InfiniteData<MessageListResponse>>(
        queryKeys.conversations.messages(parsed.data.conversationId),
        (current) => upsertMessage(current, parsed.data, prepend),
      );
      void queryClient.invalidateQueries({
        predicate: (query) =>
          query.queryKey[0] === "organizations" &&
          ["channels", "direct-messages", "direct-message-preview"].includes(
            String(query.queryKey[2]),
          ),
      });
      void queryClient.invalidateQueries({
        queryKey: queryKeys.conversations.detail(parsed.data.conversationId),
      });
    };
    nextSocket.on("message:created", (message) => handleMessage(message, true));
    nextSocket.on("message:updated", (message) =>
      handleMessage(message, false),
    );
    nextSocket.on("message:deleted", (message) =>
      handleMessage(message, false),
    );
    nextSocket.on("conversation:activity", (raw) => {
      const parsed = conversationActivityEventSchema.safeParse(raw);
      if (!parsed.success || parsed.data.actorUserId === user?.id) return;
      if (seenActivityIds.has(parsed.data.activityId)) return;
      seenActivityIds.add(parsed.data.activityId);
      seenActivityQueue.push(parsed.data.activityId);
      if (seenActivityQueue.length > 200) {
        const oldest = seenActivityQueue.shift();
        if (oldest) seenActivityIds.delete(oldest);
      }

      void queryClient.invalidateQueries({
        predicate: (query) =>
          query.queryKey[0] === "organizations" &&
          query.queryKey[1] === parsed.data.organizationId &&
          (parsed.data.conversationType === "CHANNEL"
            ? query.queryKey[2] === "channels"
            : ["direct-messages", "direct-message-preview"].includes(
                String(query.queryKey[2]),
              )),
      });
      void queryClient.invalidateQueries({
        exact: true,
        queryKey: queryKeys.conversations.detail(parsed.data.conversationId),
      });
      if (!joinedConversationIdsRef.current.has(parsed.data.conversationId)) {
        void queryClient.invalidateQueries({
          exact: true,
          queryKey: queryKeys.conversations.messages(
            parsed.data.conversationId,
          ),
        });
      }

      if (
        parsed.data.kind !== ConversationActivityKind.MESSAGE_CREATED ||
        joinedConversationIdsRef.current.has(parsed.data.conversationId)
      ) {
        return;
      }
      const sender = queryClient
        .getQueryData<OrganizationMemberDto[]>(
          queryKeys.members.list(parsed.data.organizationId),
        )
        ?.find((member) => member.user.id === parsed.data.actorUserId)?.user;
      const senderName = sender?.displayName ?? "A member";
      const direct = parsed.data.conversationType === "DIRECT";
      notify({
        id: parsed.data.activityId,
        title: direct
          ? `${senderName} sent you a direct message`
          : `${senderName} posted in a channel`,
        description: "Open the conversation to read the new message.",
        href: `/app/${parsed.data.organizationId}/${
          direct ? "direct-messages" : "channels"
        }/${parsed.data.conversationId}`,
      });
    });
    nextSocket.on("channel-read-receipts:changed", (raw) => {
      const parsed = channelReadReceiptsChangedEventSchema.safeParse(raw);
      if (!parsed.success) return;
      const existing = receiptInvalidationTimers.get(
        parsed.data.conversationId,
      );
      if (existing) clearTimeout(existing);
      receiptInvalidationTimers.set(
        parsed.data.conversationId,
        setTimeout(() => {
          receiptInvalidationTimers.delete(parsed.data.conversationId);
          void queryClient.invalidateQueries({
            queryKey: [
              "conversations",
              parsed.data.conversationId,
              "message-readers",
            ],
          });
        }, 150),
      );
    });
    nextSocket.on("membership:joined", (raw) => {
      const parsed = membershipJoinedEventSchema.safeParse(raw);
      if (!parsed.success) return;
      void queryClient.invalidateQueries({
        exact: true,
        queryKey: queryKeys.members.list(parsed.data.organizationId),
      });
    });
    nextSocket.on("presence:updated", (raw) => {
      const parsed = presenceEventSchema.safeParse(raw);
      if (!parsed.success) return;
      queryClient.setQueriesData<OrganizationMemberDto[]>(
        {
          queryKey: ["organizations"],
          predicate: (query) => query.queryKey.at(-1) === "members",
        },
        (members) =>
          members?.map((member) =>
            member.user.id === parsed.data.userId
              ? { ...member, user: { ...member.user, ...parsed.data } }
              : member,
          ),
      );
    });
    nextSocket.on("typing:updated", (raw) => {
      const parsed = typingEventSchema.safeParse(raw);
      if (!parsed.success) return;
      applyTypingUpdate(parsed.data);
    });
    nextSocket.on("read-receipt:updated", (raw) => {
      const parsed = readReceiptEventSchema.safeParse(raw);
      if (!parsed.success) return;
      if (!user || parsed.data.userId === user.id) return;
      queryClient.setQueryData<ConversationDto>(
        queryKeys.conversations.detail(parsed.data.conversationId),
        (conversation) =>
          mergePeerReadReceipt(conversation, parsed.data, user.id),
      );
      queryClient.setQueriesData<InfiniteData<DirectMessageListResponse>>(
        {
          predicate: (query) =>
            query.queryKey[0] === "organizations" &&
            query.queryKey[2] === "direct-messages",
        },
        (data) =>
          mergePeerReceiptIntoInfiniteDirectMessages(
            data,
            parsed.data,
            user.id,
          ),
      );
      queryClient.setQueriesData<DirectMessageListResponse>(
        {
          predicate: (query) =>
            query.queryKey[0] === "organizations" &&
            query.queryKey[2] === "direct-message-preview",
        },
        (data) =>
          mergePeerReceiptIntoDirectMessagePage(data, parsed.data, user.id),
      );
    });
    nextSocket.on("conversation:access-revoked", ({ conversationId }) => {
      joinedConversationIdsRef.current.delete(conversationId);
      clearTypingConversation(conversationId);
      setRevokedConversationId(conversationId);
      queryClient.removeQueries({
        queryKey: queryKeys.conversations.detail(conversationId),
      });
      queryClient.removeQueries({
        queryKey: queryKeys.conversations.messages(conversationId),
      });
    });

    setSocket(nextSocket);
    nextSocket.connect();
    return () => {
      if (reconnectTimer) clearTimeout(reconnectTimer);
      for (const timer of receiptInvalidationTimers.values()) {
        clearTimeout(timer);
      }
      joinedConversationIdsRef.current.clear();
      clearAllTyping();
      nextSocket.disconnect();
      setConnected(false);
    };
  }, [
    accessToken,
    applyTypingUpdate,
    clearAllTyping,
    clearTypingConversation,
    notify,
    queryClient,
    socketFactory,
    status,
    user?.id,
  ]);

  const subscribeOrganization = useCallback(
    async (organizationId: string) => {
      const result = await emitOrganization(
        socket,
        "organization:subscribe",
        organizationId,
      );
      if (result.success) {
        await queryClient.invalidateQueries({
          exact: true,
          queryKey: queryKeys.members.list(organizationId),
        });
      }
      return result;
    },
    [queryClient, socket],
  );
  const unsubscribeOrganization = useCallback(
    (organizationId: string) =>
      emitOrganization(socket, "organization:unsubscribe", organizationId),
    [socket],
  );
  const joinConversation = useCallback(
    async (conversationId: string) => {
      const result = await emitAcknowledged(
        socket,
        "conversation:join",
        conversationId,
      );
      if (result.success) {
        joinedConversationIdsRef.current.add(conversationId);
        setRevokedConversationId((current) =>
          current === conversationId ? null : current,
        );
      }
      return result;
    },
    [socket],
  );
  const leaveConversation = useCallback(
    (conversationId: string) => {
      joinedConversationIdsRef.current.delete(conversationId);
      clearTypingConversation(conversationId);
      return emitAcknowledged(socket, "conversation:leave", conversationId);
    },
    [clearTypingConversation, socket],
  );
  const startTyping = useCallback(
    (conversationId: string) => {
      void emitAcknowledged(socket, "typing:start", conversationId);
    },
    [socket],
  );
  const stopTyping = useCallback(
    (conversationId: string) => {
      void emitAcknowledged(socket, "typing:stop", conversationId);
    },
    [socket],
  );
  return (
    <RealtimeContext.Provider
      value={{
        connected,
        revokedConversationId,
        typingUserIds,
        subscribeOrganization,
        unsubscribeOrganization,
        joinConversation,
        leaveConversation,
        startTyping,
        stopTyping,
      }}
    >
      {children}
    </RealtimeContext.Provider>
  );
}

export const useRealtime = () => {
  const context = useContext(RealtimeContext);
  if (!context)
    throw new Error("useRealtime must be used within RealtimeProvider");
  return context;
};
