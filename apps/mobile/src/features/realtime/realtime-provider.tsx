import type { OrganizationMemberDto } from "@intouch/shared/memberships";
import type {
  ConversationDto,
  DirectMessageListResponse,
} from "@intouch/shared/conversations";
import type { MessageListResponse } from "@intouch/shared/messages";
import {
  channelReadReceiptsChangedEventSchema,
  conversationAccessRevokedEventSchema,
  conversationActivityEventSchema,
  membershipJoinedEventSchema,
  messageEventSchema,
  messageReactionsChangedEventSchema,
  notificationChangedEventSchema,
  presenceEventSchema,
  readReceiptEventSchema,
  socketAcknowledgementSchema,
  typingEventSchema,
  voiceOccupancyUpdatedEventSchema,
  type SocketAcknowledgementResult,
} from "@intouch/shared/realtime";
import { useQueryClient, type InfiniteData } from "@tanstack/react-query";
import { router } from "expo-router";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type PropsWithChildren,
} from "react";
import { AppState } from "react-native";
import { io, type Socket } from "socket.io-client";

import { mobileConfig } from "@/core/config";
import { useToast } from "@/components/ui/toast-provider";
import { useAuth } from "@/features/auth/auth-provider";
import {
  mergePeerReceiptIntoConversation,
  mergePeerReceiptIntoDirectPages,
} from "@/features/messages/receipt-cache";
import { mergeReactionStateIntoMessagePages } from "@/features/messages/reaction-cache";
import { messagesApi } from "@/features/messages/messages-api";
import { useWorkspace } from "@/features/organizations/workspace-provider";

interface RealtimeValue {
  connected: boolean;
  joinConversation: (id: string) => Promise<SocketAcknowledgementResult>;
  leaveConversation: (id: string) => Promise<SocketAcknowledgementResult>;
  startTyping: (id: string) => void;
  stopTyping: (id: string) => void;
  typingUserIds: (id: string) => string[];
}

const RealtimeContext = createContext<RealtimeValue | null>(null);
const unavailable: SocketAcknowledgementResult = {
  success: false,
  error: { code: "REALTIME_UNAVAILABLE", message: "Realtime is unavailable" },
};

const acknowledged = (
  socket: Socket | null,
  event: "conversation:join" | "conversation:leave",
  conversationId: string,
) =>
  new Promise<SocketAcknowledgementResult>((resolve) => {
    if (!socket?.connected) return resolve(unavailable);
    socket.emit(event, { conversationId }, (value: unknown) => {
      const parsed = socketAcknowledgementSchema.safeParse(value);
      resolve(parsed.success ? parsed.data : unavailable);
    });
  });

export const RealtimeProvider = ({ children }: PropsWithChildren) => {
  const { accessToken, refresh, status, user } = useAuth();
  const { activeOrganizationId } = useWorkspace();
  const queryClient = useQueryClient();
  const showToast = useToast();
  const [socket, setSocket] = useState<Socket | null>(null);
  const [connected, setConnected] = useState(false);
  const [typing, setTyping] = useState<Record<string, string[]>>({});
  const activeConversationRef = useRef<string | null>(null);
  const typingTimers = useRef(new Map<string, ReturnType<typeof setTimeout>>());
  const reactionTimers = useRef(
    new Map<string, ReturnType<typeof setTimeout>>(),
  );
  const seenActivities = useRef(new Set<string>());

  const clearTyping = useCallback(() => {
    for (const timer of typingTimers.current.values()) clearTimeout(timer);
    typingTimers.current.clear();
    setTyping({});
  }, []);

  useEffect(() => {
    if (status !== "authenticated" || !accessToken) return;

    const next = io(mobileConfig.apiUrl, {
      auth: { accessToken },
      autoConnect: AppState.currentState === "active",
      transports: ["websocket", "polling"],
    });
    setSocket(next);

    const reconcile = () => {
      void queryClient.invalidateQueries({ queryKey: ["organizations"] });
      if (activeOrganizationId) {
        next.emit("organization:subscribe", {
          organizationId: activeOrganizationId,
        });
      }
      if (activeConversationRef.current) {
        next.emit("conversation:join", {
          conversationId: activeConversationRef.current,
        });
      }
    };

    next.on("connect", () => {
      setConnected(true);
      reconcile();
    });
    next.on("disconnect", () => {
      setConnected(false);
      clearTyping();
    });
    next.on("connect_error", async (error) => {
      if (error.message.toLowerCase().includes("auth")) await refresh();
    });
    next.on("conversation:activity", (value: unknown) => {
      const parsed = conversationActivityEventSchema.safeParse(value);
      if (!parsed.success || parsed.data.actorUserId === user?.id) return;
      if (seenActivities.current.has(parsed.data.activityId)) return;
      seenActivities.current.add(parsed.data.activityId);
      if (seenActivities.current.size > 300) seenActivities.current.clear();
      void queryClient.invalidateQueries({
        queryKey: [
          "organizations",
          parsed.data.organizationId,
          "conversations",
        ],
      });
      if (
        parsed.data.kind === "MESSAGE_CREATED" &&
        activeConversationRef.current !== parsed.data.conversationId
      ) {
        const members = queryClient.getQueryData<OrganizationMemberDto[]>([
          "organizations",
          parsed.data.organizationId,
          "members",
        ]);
        const actorName =
          members?.find((member) => member.user.id === parsed.data.actorUserId)
            ?.user.displayName ?? "A teammate";
        showToast(`${actorName} sent a message`, {
          label: "Open",
          onPress: () =>
            router.push(`/conversation/${parsed.data.conversationId}`),
        });
      }
    });
    next.on("message:created", (value: unknown) => {
      const parsed = messageEventSchema.safeParse(value);
      if (!parsed.success) return;
      void queryClient.invalidateQueries({
        queryKey: ["messages", parsed.data.conversationId],
      });
    });
    next.on("notification:changed", (value: unknown) => {
      const parsed = notificationChangedEventSchema.safeParse(value);
      if (!parsed.success) return;
      void queryClient.invalidateQueries({ queryKey: ["notifications"] });
      if (
        parsed.data.kind === "UPSERTED" &&
        parsed.data.notification.type === "ORGANIZATION_INVITATION_RECEIVED"
      ) {
        void queryClient.invalidateQueries({ queryKey: ["invitations"] });
      }
    });
    for (const event of ["message:updated", "message:deleted"] as const) {
      next.on(event, (value: unknown) => {
        const parsed = messageEventSchema.safeParse(value);
        if (parsed.success) {
          void queryClient.invalidateQueries({
            queryKey: ["messages", parsed.data.conversationId],
          });
        }
      });
    }
    next.on("message-reactions:changed", (value: unknown) => {
      const parsed = messageReactionsChangedEventSchema.safeParse(value);
      if (parsed.success) {
        const key = parsed.data.messageId;
        const previous = reactionTimers.current.get(key);
        if (previous) clearTimeout(previous);
        reactionTimers.current.set(
          key,
          setTimeout(() => {
            reactionTimers.current.delete(key);
            void messagesApi
              .reactionState(parsed.data.messageId)
              .then((reactionState) => {
                queryClient.setQueryData<InfiniteData<MessageListResponse>>(
                  ["messages", parsed.data.conversationId],
                  (current) =>
                    mergeReactionStateIntoMessagePages(current, reactionState),
                );
                void queryClient.invalidateQueries({
                  queryKey: [
                    "messages",
                    parsed.data.messageId,
                    "reaction-users",
                  ],
                });
              })
              .catch(() => undefined);
          }, 150),
        );
      }
    });
    next.on("read-receipt:updated", (value: unknown) => {
      const parsed = readReceiptEventSchema.safeParse(value);
      if (!parsed.success || !user) return;
      queryClient.setQueryData<ConversationDto>(
        ["conversations", parsed.data.conversationId],
        (current) =>
          mergePeerReceiptIntoConversation(current, parsed.data, user.id),
      );
      if (activeOrganizationId) {
        queryClient.setQueriesData<InfiniteData<DirectMessageListResponse>>(
          {
            queryKey: [
              "organizations",
              activeOrganizationId,
              "conversations",
              "directs",
            ],
          },
          (current) =>
            mergePeerReceiptIntoDirectPages(current, parsed.data, user.id),
        );
      }
    });
    next.on("channel-read-receipts:changed", (value: unknown) => {
      const parsed = channelReadReceiptsChangedEventSchema.safeParse(value);
      if (parsed.success) {
        void queryClient.invalidateQueries({
          queryKey: ["messages", parsed.data.conversationId],
        });
      }
    });
    next.on("presence:updated", (value: unknown) => {
      const parsed = presenceEventSchema.safeParse(value);
      if (!parsed.success || !activeOrganizationId) return;
      queryClient.setQueryData<OrganizationMemberDto[]>(
        ["organizations", activeOrganizationId, "members"],
        (members) => {
          if (!members) return members;
          const index = members.findIndex(
            (member) => member.user.id === parsed.data.userId,
          );
          const member = members[index];
          if (
            !member ||
            (member.user.status === parsed.data.status &&
              member.user.lastSeenAt === parsed.data.lastSeenAt)
          ) {
            return members;
          }
          return members.with(index, {
            ...member,
            user: { ...member.user, ...parsed.data },
          });
        },
      );
    });
    next.on("membership:joined", (value: unknown) => {
      const parsed = membershipJoinedEventSchema.safeParse(value);
      if (!parsed.success) return;
      void queryClient.invalidateQueries({ queryKey: ["organizations"] });
      void queryClient.invalidateQueries({
        queryKey: ["organizations", parsed.data.organizationId],
      });
    });
    next.on("typing:updated", (value: unknown) => {
      const parsed = typingEventSchema.safeParse(value);
      if (!parsed.success || parsed.data.userId === user?.id) return;
      const key = `${parsed.data.conversationId}:${parsed.data.userId}`;
      const previous = typingTimers.current.get(key);
      if (previous) clearTimeout(previous);
      setTyping((current) => {
        const users = current[parsed.data.conversationId] ?? [];
        if (!parsed.data.isTyping && !users.includes(parsed.data.userId)) {
          return current;
        }
        const nextUsers = parsed.data.isTyping
          ? users.includes(parsed.data.userId)
            ? users
            : [...users, parsed.data.userId]
          : users.filter((id) => id !== parsed.data.userId);
        return nextUsers === users
          ? current
          : { ...current, [parsed.data.conversationId]: nextUsers };
      });
      if (parsed.data.isTyping) {
        typingTimers.current.set(
          key,
          setTimeout(() => {
            setTyping((current) => ({
              ...current,
              [parsed.data.conversationId]: (
                current[parsed.data.conversationId] ?? []
              ).filter((id) => id !== parsed.data.userId),
            }));
            typingTimers.current.delete(key);
          }, 7_000),
        );
      } else {
        typingTimers.current.delete(key);
      }
    });
    next.on("conversation:access-revoked", (value: unknown) => {
      const parsed = conversationAccessRevokedEventSchema.safeParse(value);
      if (!parsed.success) return;
      void queryClient.removeQueries({
        queryKey: ["messages", parsed.data.conversationId],
      });
      if (activeConversationRef.current === parsed.data.conversationId) {
        showToast("Your access to this conversation changed");
        activeConversationRef.current = null;
        router.replace("/chats");
      }
    });
    next.on("voice-channel:occupancy-updated", (value: unknown) => {
      const parsed = voiceOccupancyUpdatedEventSchema.safeParse(value);
      if (parsed.success && activeOrganizationId) {
        void queryClient.invalidateQueries({
          queryKey: ["organizations", activeOrganizationId, "conversations"],
        });
      }
    });

    const appStateSubscription = AppState.addEventListener(
      "change",
      (state) => {
        if (state === "active") {
          next.connect();
          void queryClient.invalidateQueries({ queryKey: ["notifications"] });
          void queryClient.invalidateQueries({ queryKey: ["organizations"] });
        } else next.disconnect();
      },
    );

    return () => {
      appStateSubscription.remove();
      clearTyping();
      for (const timer of reactionTimers.current.values()) clearTimeout(timer);
      reactionTimers.current.clear();
      next.disconnect();
      setSocket(null);
      setConnected(false);
    };
  }, [
    accessToken,
    activeOrganizationId,
    clearTyping,
    queryClient,
    refresh,
    showToast,
    status,
    user?.id,
  ]);

  const joinConversation = useCallback(
    async (id: string) => {
      activeConversationRef.current = id;
      return acknowledged(socket, "conversation:join", id);
    },
    [socket],
  );
  const leaveConversation = useCallback(
    async (id: string) => {
      if (activeConversationRef.current === id)
        activeConversationRef.current = null;
      return acknowledged(socket, "conversation:leave", id);
    },
    [socket],
  );
  const startTyping = useCallback(
    (id: string) => socket?.emit("typing:start", { conversationId: id }),
    [socket],
  );
  const stopTyping = useCallback(
    (id: string) => socket?.emit("typing:stop", { conversationId: id }),
    [socket],
  );
  const typingUserIds = useCallback((id: string) => typing[id] ?? [], [typing]);

  return (
    <RealtimeContext.Provider
      value={{
        connected,
        joinConversation,
        leaveConversation,
        startTyping,
        stopTyping,
        typingUserIds,
      }}
    >
      {children}
    </RealtimeContext.Provider>
  );
};

export const useRealtime = () => {
  const value = useContext(RealtimeContext);
  if (!value) throw new Error("RealtimeProvider is missing");
  return value;
};
