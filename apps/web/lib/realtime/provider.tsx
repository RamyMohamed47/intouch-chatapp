"use client";

import { useQueryClient, type InfiniteData } from "@tanstack/react-query";
import {
  messageEventSchema,
  presenceEventSchema,
  readReceiptEventSchema,
  socketAcknowledgementSchema,
  socketConnectionErrorSchema,
  typingEventSchema,
  type MessageEvent,
  type ReadReceiptEvent,
  type SocketAcknowledgementResult,
} from "@intouch/shared/realtime";
import type { OrganizationMemberDto } from "@intouch/shared/memberships";
import type { MessageListResponse } from "@intouch/shared/messages";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
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

interface RealtimeContextValue {
  connected: boolean;
  revokedConversationId: string | null;
  typingUserIds: (conversationId: string) => string[];
  readReceipt: (conversationId: string) => ReadReceiptEvent | null;
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
  const queryClient = useQueryClient();
  const [socket, setSocket] = useState<InTouchSocket | null>(null);
  const [connected, setConnected] = useState(false);
  const [accessToken, setCurrentAccessToken] = useState(getAccessToken);
  const [typing, setTyping] = useState<Record<string, string[]>>({});
  const [readReceipts, setReadReceipts] = useState<
    Record<string, ReadReceiptEvent>
  >({});
  const [revokedConversationId, setRevokedConversationId] = useState<
    string | null
  >(null);

  useEffect(() => subscribeToAccessToken(setCurrentAccessToken), []);

  useEffect(() => {
    if (status !== "authenticated" || !accessToken) {
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
    nextSocket.on("connect", () => {
      if (reconnectTimer) clearTimeout(reconnectTimer);
      reconnectTimer = undefined;
      refreshing = false;
      setConnected(true);
    });
    nextSocket.on("disconnect", (reason) => {
      setConnected(false);
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
      setTyping((current) => {
        const users = current[parsed.data.conversationId] ?? [];
        const nextUsers = parsed.data.isTyping
          ? [...new Set([...users, parsed.data.userId])]
          : users.filter((userId) => userId !== parsed.data.userId);
        return { ...current, [parsed.data.conversationId]: nextUsers };
      });
    });
    nextSocket.on("read-receipt:updated", (raw) => {
      const parsed = readReceiptEventSchema.safeParse(raw);
      if (!parsed.success) return;
      if (parsed.data.userId !== user?.id) {
        setReadReceipts((current) => ({
          ...current,
          [parsed.data.conversationId]: parsed.data,
        }));
      }
      void queryClient.invalidateQueries({
        predicate: (query) =>
          query.queryKey[0] === "organizations" &&
          ["direct-messages", "direct-message-preview"].includes(
            String(query.queryKey[2]),
          ),
      });
    });
    nextSocket.on("conversation:access-revoked", ({ conversationId }) => {
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
      nextSocket.disconnect();
      setConnected(false);
    };
  }, [accessToken, queryClient, socketFactory, status, user?.id]);

  const subscribeOrganization = useCallback(
    (organizationId: string) =>
      emitOrganization(socket, "organization:subscribe", organizationId),
    [socket],
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
        setRevokedConversationId((current) =>
          current === conversationId ? null : current,
        );
      }
      return result;
    },
    [socket],
  );
  const leaveConversation = useCallback(
    (conversationId: string) =>
      emitAcknowledged(socket, "conversation:leave", conversationId),
    [socket],
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
  const typingUserIds = useCallback(
    (conversationId: string) => typing[conversationId] ?? [],
    [typing],
  );
  const readReceipt = useCallback(
    (conversationId: string) => readReceipts[conversationId] ?? null,
    [readReceipts],
  );

  return (
    <RealtimeContext.Provider
      value={{
        connected,
        revokedConversationId,
        typingUserIds,
        readReceipt,
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
