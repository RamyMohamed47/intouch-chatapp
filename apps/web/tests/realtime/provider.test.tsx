import {
  QueryClient,
  QueryClientProvider,
  type InfiniteData,
} from "@tanstack/react-query";
import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { MessageListResponse } from "@intouch/shared/messages";
import type { OrganizationMemberDto } from "@intouch/shared/memberships";
import type {
  DirectConversationDto,
  DirectMessageListResponse,
} from "@intouch/shared/conversations";

import { AuthProvider } from "@/lib/auth/provider";
import { setAccessToken } from "@/lib/auth/access-token";
import { queryKeys } from "@/lib/query/keys";
import { useRealtime, RealtimeProvider } from "@/lib/realtime/provider";
import { NotificationProvider } from "@/components/ui/toast";
import type { InTouchSocket } from "@/lib/realtime/client";
import { server } from "../mocks/server";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

type Listener = (...args: unknown[]) => void;

class FakeSocket {
  connectCalls = 0;
  connected = false;
  readonly emitted: { event: string; input: unknown }[] = [];
  private readonly listeners: Record<string, Listener[]> = {};

  on(event: string, listener: Listener) {
    this.listeners[event] = [...(this.listeners[event] ?? []), listener];
    return this;
  }

  connect() {
    this.connectCalls += 1;
    this.connected = true;
    this.trigger("connect");
    return this;
  }

  disconnect() {
    this.connected = false;
    this.trigger("disconnect", "io client disconnect");
    return this;
  }

  emit(event: string, input: unknown, acknowledge?: Listener) {
    this.emitted.push({ event, input });
    acknowledge?.({ success: true });
    return this;
  }

  trigger(event: string, ...args: unknown[]) {
    for (const listener of this.listeners[event] ?? []) listener(...args);
  }
}

const user = {
  id: "64b000000000000000000001",
  username: "ramy",
  displayName: "Ramy Mohamed",
  email: "ramy@example.com",
  createdAt: "2026-08-05T10:00:00.000Z",
  updatedAt: "2026-08-05T10:00:00.000Z",
};
const organizationId = "64c000000000000000000001";
const conversationId = "64d000000000000000000001";
const inactiveConversationId = "64d000000000000000000002";

function Probe() {
  const realtime = useRealtime();
  return (
    <div>
      <span>{realtime.connected ? "connected" : "disconnected"}</span>
      <span>{realtime.typingUserIds(conversationId).join(",")}</span>
      <span>{realtime.revokedConversationId ?? "accessible"}</span>
      <button
        type="button"
        onClick={() => void realtime.joinConversation(conversationId)}
      >
        Join
      </button>
      <button
        type="button"
        onClick={() => void realtime.subscribeOrganization(organizationId)}
      >
        Subscribe
      </button>
    </div>
  );
}

describe("RealtimeProvider", () => {
  beforeEach(() => {
    setAccessToken(null);
    server.use(
      http.post("http://localhost:3000/api/v1/auth/refresh", () =>
        HttpResponse.json({ accessToken: "socket-token" }),
      ),
      http.get("http://localhost:3000/api/v1/auth/me", () =>
        HttpResponse.json({ user }),
      ),
    );
  });

  it("uses the injected socket and merges validated realtime events", async () => {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    const fakeSocket = new FakeSocket();
    const invalidateQueries = vi.spyOn(queryClient, "invalidateQueries");
    const member: OrganizationMemberDto = {
      membershipId: "64e000000000000000000001",
      role: "OWNER",
      joinedAt: "2026-08-05T10:00:00.000Z",
      user: {
        id: user.id,
        username: user.username,
        displayName: user.displayName,
        avatarAssetId: null,
        status: "OFFLINE",
        lastSeenAt: null,
      },
    };
    const peerMember: OrganizationMemberDto = {
      membershipId: "64e000000000000000000002",
      role: "MEMBER",
      joinedAt: "2026-08-05T10:00:00.000Z",
      user: {
        id: "64b000000000000000000002",
        username: "lina",
        displayName: "Lina Hassan",
        avatarAssetId: null,
        status: "ONLINE",
        lastSeenAt: null,
      },
    };
    queryClient.setQueryData(queryKeys.members.list(organizationId), [
      member,
      peerMember,
    ]);
    queryClient.setQueryData<InfiniteData<MessageListResponse>>(
      queryKeys.conversations.messages(conversationId),
      {
        pages: [{ messages: [], nextCursor: null }],
        pageParams: [undefined],
      },
    );
    const directConversation: DirectConversationDto = {
      id: conversationId,
      organizationId,
      type: "DIRECT",
      peer: {
        id: "64b000000000000000000002",
        username: "lina",
        displayName: "Lina Hassan",
        avatarAssetId: null,
      },
      lastMessage: null,
      unreadCount: 0,
      readReceipt: null,
      peerReadReceipt: null,
      createdAt: "2026-08-05T10:00:00.000Z",
      updatedAt: "2026-08-05T10:00:00.000Z",
    };
    queryClient.setQueryData(
      queryKeys.conversations.detail(conversationId),
      directConversation,
    );
    queryClient.setQueryData<DirectMessageListResponse>(
      queryKeys.conversations.directMessagePreview(organizationId),
      { directMessages: [directConversation], nextCursor: null },
    );
    queryClient.setQueryData<InfiniteData<DirectMessageListResponse>>(
      queryKeys.conversations.directMessages(organizationId),
      {
        pages: [{ directMessages: [directConversation], nextCursor: null }],
        pageParams: [undefined],
      },
    );

    render(
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <NotificationProvider>
            <RealtimeProvider
              socketFactory={() => fakeSocket as unknown as InTouchSocket}
            >
              <Probe />
            </RealtimeProvider>
          </NotificationProvider>
        </AuthProvider>
      </QueryClientProvider>,
    );

    await screen.findByText("connected");
    await userEvent.click(screen.getByRole("button", { name: "Join" }));
    expect(fakeSocket.emitted).toContainEqual({
      event: "conversation:join",
      input: { conversationId },
    });

    act(() => {
      fakeSocket.trigger("notification:changed", {
        kind: "UPSERTED",
        notification: {
          id: "507f1f77bcf86cd799439061",
          type: "DIRECT_MESSAGE_RECEIVED",
          actor: peerMember.user,
          organization: { id: organizationId, name: "Northstar" },
          conversationId,
          latestMessageId: "507f1f77bcf86cd799439062",
          messageCount: 1,
          readAt: null,
          createdAt: "2026-08-29T00:00:00.000Z",
          lastActivityAt: "2026-08-29T00:00:00.000Z",
        },
      });
    });
    expect(
      screen.queryByText("Lina Hassan sent you a direct message"),
    ).not.toBeInTheDocument();

    invalidateQueries.mockClear();
    act(() => {
      const activity = {
        kind: "UPSERTED" as const,
        notification: {
          id: "507f1f77bcf86cd799439063",
          type: "DIRECT_MESSAGE_RECEIVED" as const,
          actor: peerMember.user,
          organization: { id: organizationId, name: "Northstar" },
          conversationId: inactiveConversationId,
          latestMessageId: "507f1f77bcf86cd799439064",
          messageCount: 1,
          readAt: null,
          createdAt: "2026-08-29T00:00:00.000Z",
          lastActivityAt: "2026-08-29T00:00:00.000Z",
        },
      };
      fakeSocket.trigger("notification:changed", activity);
      fakeSocket.trigger("notification:changed", activity);
    });
    expect(
      await screen.findByText("Lina Hassan sent you a direct message"),
    ).toBeInTheDocument();
    expect(
      screen.getAllByText("Lina Hassan sent you a direct message"),
    ).toHaveLength(1);
    expect(invalidateQueries).toHaveBeenCalled();

    invalidateQueries.mockClear();
    await userEvent.click(screen.getByRole("button", { name: "Subscribe" }));
    await waitFor(() =>
      expect(invalidateQueries).toHaveBeenCalledWith({
        exact: true,
        queryKey: queryKeys.members.list(organizationId),
      }),
    );
    expect(fakeSocket.emitted).toContainEqual({
      event: "organization:subscribe",
      input: { organizationId },
    });

    invalidateQueries.mockClear();
    act(() => {
      fakeSocket.trigger("membership:joined", {
        organizationId,
        userId: "64b000000000000000000002",
      });
    });
    expect(invalidateQueries).toHaveBeenCalledWith({
      exact: true,
      queryKey: queryKeys.members.list(organizationId),
    });

    act(() => {
      fakeSocket.trigger("typing:updated", {
        conversationId,
        userId: "64b000000000000000000002",
        isTyping: true,
      });
      fakeSocket.trigger("presence:updated", {
        userId: user.id,
        status: "ONLINE",
        lastSeenAt: null,
      });
      fakeSocket.trigger("message:created", {
        id: "64f000000000000000000001",
        conversationId,
        senderId: user.id,
        content: "Realtime message",
        messageType: "TEXT",
        editedAt: null,
        deletedAt: null,
        createdAt: "2026-08-05T10:05:00.000Z",
        updatedAt: "2026-08-05T10:05:00.000Z",
      });
      fakeSocket.trigger("read-receipt:updated", {
        id: "650000000000000000000001",
        conversationId,
        userId: directConversation.peer.id,
        lastReadMessageId: "64f000000000000000000001",
        lastReadAt: "2026-08-05T10:06:00.000Z",
      });
      fakeSocket.trigger("channel-read-receipts:changed", { conversationId });
    });

    expect(screen.getByText("64b000000000000000000002")).toBeInTheDocument();
    act(() => {
      fakeSocket.trigger("typing:updated", {
        conversationId,
        userId: user.id,
        isTyping: true,
      });
    });
    expect(screen.queryByText(user.id)).not.toBeInTheDocument();
    await waitFor(() => {
      expect(
        queryClient.getQueryData<OrganizationMemberDto[]>(
          queryKeys.members.list(organizationId),
        )?.[0]?.user.status,
      ).toBe("ONLINE");
      expect(
        queryClient.getQueryData<InfiniteData<MessageListResponse>>(
          queryKeys.conversations.messages(conversationId),
        )?.pages[0]?.messages[0]?.content,
      ).toBe("Realtime message");
      expect(
        queryClient.getQueryData<DirectConversationDto>(
          queryKeys.conversations.detail(conversationId),
        )?.peerReadReceipt?.userId,
      ).toBe(directConversation.peer.id);
      expect(
        queryClient.getQueryData<DirectMessageListResponse>(
          queryKeys.conversations.directMessagePreview(organizationId),
        )?.directMessages[0]?.peerReadReceipt?.lastReadMessageId,
      ).toBe("64f000000000000000000001");
    });
    await waitFor(() =>
      expect(invalidateQueries).toHaveBeenCalledWith({
        queryKey: ["conversations", conversationId, "message-readers"],
      }),
    );

    act(() => {
      fakeSocket.trigger("conversation:access-revoked", { conversationId });
    });
    expect(screen.getByText(conversationId)).toBeInTheDocument();
    expect(
      screen.queryByText("64b000000000000000000002"),
    ).not.toBeInTheDocument();
  });

  it("refreshes only authentication failures and delays throttled reconnects", async () => {
    let refreshCalls = 0;
    server.use(
      http.post("http://localhost:3000/api/v1/auth/refresh", () => {
        refreshCalls += 1;
        return HttpResponse.json({ accessToken: "socket-token" });
      }),
    );
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    const fakeSocket = new FakeSocket();

    render(
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <NotificationProvider>
            <RealtimeProvider
              socketFactory={() => fakeSocket as unknown as InTouchSocket}
            >
              <Probe />
            </RealtimeProvider>
          </NotificationProvider>
        </AuthProvider>
      </QueryClientProvider>,
    );

    await screen.findByText("connected");
    expect(refreshCalls).toBe(1);
    act(() => {
      fakeSocket.trigger("connect_error", new Error("network unavailable"));
    });
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(refreshCalls).toBe(1);

    const throttled = Object.assign(new Error("limited"), {
      data: {
        code: "TOO_MANY_REQUESTS",
        message: "Too many realtime connection attempts",
        retryAfterMs: 10,
      },
    });
    act(() => fakeSocket.trigger("connect_error", throttled));
    await waitFor(() => expect(fakeSocket.connectCalls).toBe(2));
    expect(refreshCalls).toBe(1);

    const unauthorized = Object.assign(new Error("expired"), {
      data: { code: "UNAUTHORIZED", message: "Invalid access token" },
    });
    act(() => fakeSocket.trigger("connect_error", unauthorized));
    await waitFor(() => expect(refreshCalls).toBe(2));
  });
});
