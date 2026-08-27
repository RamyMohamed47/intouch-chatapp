import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  const createdMessage = {
    id: "64f000000000000000000001",
    conversationId: "64d000000000000000000001",
    senderId: "64b000000000000000000001",
    content: "Hello team",
    messageType: "TEXT" as const,
    createdAt: "2026-08-08T10:00:00.000Z",
    updatedAt: "2026-08-08T10:00:00.000Z",
    editedAt: null,
    deletedAt: null,
  };
  const state: {
    conversationType: "CHANNEL" | "DIRECT";
    currentUserRole: "MEMBER" | "OWNER";
    messages: (typeof createdMessage)[];
    peerReadReceipt: {
      id: string;
      conversationId: string;
      userId: string;
      lastReadMessageId: string;
      lastReadAt: string;
    } | null;
    channelReaderSummary:
      | {
          messageId: string;
          readByCount: number;
          readers: Array<{
            id: string;
            username: string;
            displayName: string;
          }>;
        }
      | undefined;
  } = {
    conversationType: "CHANNEL",
    currentUserRole: "OWNER",
    messages: [],
    peerReadReceipt: null,
    channelReaderSummary: undefined,
  };

  return {
    createdMessage,
    createMessage: vi.fn(() => Promise.resolve(createdMessage)),
    state,
    joinConversation: vi.fn(() => Promise.resolve({ success: true })),
    leaveConversation: vi.fn(() => Promise.resolve({ success: true })),
    startTyping: vi.fn(),
    stopTyping: vi.fn(),
    updateReadReceipt: vi.fn(() =>
      Promise.resolve({
        id: "650000000000000000000001",
        organizationId: "64c000000000000000000001",
        conversationId: "64d000000000000000000001",
        userId: "64b000000000000000000001",
        lastReadMessageId: createdMessage.id,
        lastReadAt: "2026-08-08T10:00:00.000Z",
      }),
    ),
  };
});

vi.mock("@/components/memberships/invite-member-dialog", () => ({
  InviteMemberDialog: () => <button type="button">Invite member</button>,
}));

vi.mock("@/lib/auth/provider", () => ({
  useAuth: () => ({
    user: {
      id: "64b000000000000000000001",
      username: "ramy",
      displayName: "Ramy Mohamed",
      email: "ramy@example.com",
      createdAt: "2026-08-01T10:00:00.000Z",
      updatedAt: "2026-08-01T10:00:00.000Z",
    },
  }),
}));

vi.mock("@/lib/realtime/provider", () => ({
  useRealtime: () => ({
    connected: true,
    revokedConversationId: null,
    joinConversation: mocks.joinConversation,
    leaveConversation: mocks.leaveConversation,
    startTyping: mocks.startTyping,
    stopTyping: mocks.stopTyping,
    typingUserIds: () => [],
  }),
}));

vi.mock("@/lib/query/hooks", () => ({
  useOrganization: () => ({
    data: {
      id: "64c000000000000000000001",
      name: "InTouch",
      slug: "intouch",
      visibility: "PRIVATE",
      currentUserRole: mocks.state.currentUserRole,
      createdAt: "2026-08-01T10:00:00.000Z",
      updatedAt: "2026-08-01T10:00:00.000Z",
    },
    isPending: false,
    isError: false,
  }),
  useConversation: () => ({
    data:
      mocks.state.conversationType === "CHANNEL"
        ? {
            id: "64d000000000000000000001",
            organizationId: "64c000000000000000000001",
            categoryId: "64e000000000000000000001",
            name: "general",
            type: "CHANNEL",
            visibility: "PUBLIC",
            position: 0,
            createdAt: "2026-08-01T10:00:00.000Z",
            updatedAt: "2026-08-01T10:00:00.000Z",
          }
        : {
            id: "64d000000000000000000001",
            organizationId: "64c000000000000000000001",
            type: "DIRECT",
            peer: {
              id: "64b000000000000000000002",
              username: "lina",
              displayName: "Lina Hassan",
            },
            lastMessage: null,
            unreadCount: 0,
            readReceipt: null,
            peerReadReceipt: mocks.state.peerReadReceipt,
            createdAt: "2026-08-01T10:00:00.000Z",
            updatedAt: "2026-08-01T10:00:00.000Z",
          },
    isPending: false,
    isError: false,
  }),
  useMessages: () => ({
    data: {
      pages: [{ messages: mocks.state.messages, nextCursor: null }],
    },
    isPending: false,
    isError: false,
    hasNextPage: false,
    isFetchingNextPage: false,
    fetchNextPage: vi.fn(),
    refetch: vi.fn(),
  }),
  useMembers: () => ({
    data: [
      {
        membershipId: "64e000000000000000000002",
        role: "MEMBER",
        joinedAt: "2026-08-01T10:00:00.000Z",
        user: {
          id: "64b000000000000000000002",
          username: "lina",
          displayName: "Lina Hassan",
          status: "ONLINE",
          lastSeenAt: null,
        },
      },
    ],
    isPending: false,
    isError: false,
  }),
  useMessageReaders: () => ({
    data: mocks.state.channelReaderSummary,
    isPending: false,
    isError: false,
  }),
}));

vi.mock("@/lib/api/messages", () => ({
  messagesApi: {
    create: mocks.createMessage,
    update: vi.fn(),
    remove: vi.fn(),
    updateReadReceipt: mocks.updateReadReceipt,
    listReaders: vi.fn(),
  },
}));

import { ConversationPage } from "@/components/conversations/conversation-page";

const renderConversation = () => {
  const queryClient = new QueryClient({
    defaultOptions: { mutations: { retry: false }, queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <ConversationPage
        organizationId="64c000000000000000000001"
        conversationId="64d000000000000000000001"
        expectedType={mocks.state.conversationType}
      />
    </QueryClientProvider>,
  );
};

describe("ConversationPage interactions", () => {
  beforeEach(() => {
    mocks.state.conversationType = "CHANNEL";
    mocks.state.currentUserRole = "OWNER";
    mocks.state.messages = [];
    mocks.state.peerReadReceipt = null;
    mocks.state.channelReaderSummary = undefined;
    mocks.createMessage.mockClear();
  });

  afterEach(() => {
    vi.clearAllMocks();
    vi.useRealTimers();
  });

  it("shows the invitation shortcut only to organization owners", () => {
    const ownerView = renderConversation();
    expect(
      screen.getByRole("button", { name: "Invite member" }),
    ).toBeInTheDocument();

    ownerView.unmount();
    mocks.state.currentUserRole = "MEMBER";
    renderConversation();
    expect(
      screen.queryByRole("button", { name: "Invite member" }),
    ).not.toBeInTheDocument();
  });

  it("shows the direct-message peer presence in the header", () => {
    mocks.state.conversationType = "DIRECT";
    renderConversation();

    expect(
      screen.getByRole("heading", { name: "Lina Hassan" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("status", { name: "Lina Hassan is online" }),
    ).toHaveTextContent("Online");
  });

  it("shows Read under the latest outgoing DM even when a newer reply follows", () => {
    mocks.state.conversationType = "DIRECT";
    const incoming = {
      ...mocks.createdMessage,
      id: "64f000000000000000000002",
      senderId: "64b000000000000000000002",
      content: "Reply",
      createdAt: "2026-08-08T10:01:00.000Z",
      updatedAt: "2026-08-08T10:01:00.000Z",
    };
    mocks.state.messages = [mocks.createdMessage, incoming];
    mocks.state.peerReadReceipt = {
      id: "650000000000000000000002",
      conversationId: "64d000000000000000000001",
      userId: "64b000000000000000000002",
      lastReadMessageId: incoming.id,
      lastReadAt: "2026-08-08T10:02:00.000Z",
    };

    renderConversation();

    expect(
      screen.getByRole("status", { name: "Message read" }),
    ).toHaveTextContent("Read");
  });

  it("shows Sent for unread direct and channel messages", () => {
    mocks.state.conversationType = "DIRECT";
    mocks.state.messages = [mocks.createdMessage];
    const directView = renderConversation();
    expect(
      screen.getByRole("status", { name: "Message sent" }),
    ).toHaveTextContent("Sent");

    directView.unmount();
    mocks.state.conversationType = "CHANNEL";
    renderConversation();
    expect(
      screen.getByRole("status", { name: "Message sent" }),
    ).toHaveTextContent("Sent");
  });

  it("shows a sender-only channel reader preview", async () => {
    mocks.state.messages = [mocks.createdMessage];
    mocks.state.channelReaderSummary = {
      messageId: mocks.createdMessage.id,
      readByCount: 4,
      readers: [
        {
          id: "64b000000000000000000002",
          username: "lina",
          displayName: "Lina Hassan",
        },
      ],
    };
    renderConversation();

    const trigger = screen.getByRole("button", { name: "Read by 4 members" });
    expect(trigger).toHaveTextContent("Read by 4");
    await userEvent.click(trigger);
    expect(screen.getByText("Lina Hassan")).toBeInTheDocument();
    expect(screen.getByText("And 3 others")).toBeInTheDocument();
  });

  it("does not advance while inactive or reading history", async () => {
    mocks.state.conversationType = "DIRECT";
    mocks.state.messages = [
      {
        ...mocks.createdMessage,
        senderId: "64b000000000000000000002",
      },
    ];
    const hasFocus = vi.spyOn(document, "hasFocus").mockReturnValue(false);
    vi.spyOn(document, "visibilityState", "get").mockReturnValue("visible");
    const view = renderConversation();
    const viewport = view.container.querySelector<HTMLElement>(
      '[data-slot="scroll-area-viewport"]',
    );
    expect(viewport).not.toBeNull();
    Object.defineProperties(viewport!, {
      clientHeight: { configurable: true, value: 500 },
      scrollHeight: { configurable: true, value: 1_000 },
      scrollTop: { configurable: true, value: 200, writable: true },
    });
    fireEvent.scroll(viewport!);

    hasFocus.mockReturnValue(true);
    fireEvent.focus(window);
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(mocks.updateReadReceipt).not.toHaveBeenCalled();

    viewport!.scrollTop = 500;
    fireEvent.scroll(viewport!);
    await waitFor(() =>
      expect(mocks.updateReadReceipt).toHaveBeenCalledWith(
        "64d000000000000000000001",
        { messageId: mocks.createdMessage.id },
      ),
    );
  });

  it("submits with Enter and keeps Shift+Enter and composing Enter available", async () => {
    const user = userEvent.setup();
    renderConversation();
    const composer = screen.getByPlaceholderText("Message general");

    await user.type(composer, "Hello team");
    fireEvent.keyDown(composer, { key: "Enter", shiftKey: true });
    fireEvent.keyDown(composer, { key: "Enter", isComposing: true });
    expect(mocks.createMessage).not.toHaveBeenCalled();

    fireEvent.keyDown(composer, { key: "Enter" });
    await waitFor(() =>
      expect(mocks.createMessage).toHaveBeenCalledWith(
        "64d000000000000000000001",
        { content: "Hello team" },
      ),
    );
    await waitFor(() => expect(composer).toHaveValue(""));
  });

  it("starts immediately, refreshes every three seconds, and stops on cleanup", () => {
    vi.useFakeTimers();
    const view = renderConversation();
    const composer = screen.getByPlaceholderText("Message general");
    mocks.startTyping.mockClear();
    mocks.stopTyping.mockClear();

    fireEvent.focus(composer);
    fireEvent.change(composer, { target: { value: "Draft" } });
    expect(mocks.startTyping).toHaveBeenCalledTimes(1);

    act(() => {
      vi.advanceTimersByTime(3_000);
    });
    expect(mocks.startTyping).toHaveBeenCalledTimes(2);

    fireEvent.blur(composer);
    expect(mocks.stopTyping).toHaveBeenCalled();

    fireEvent.focus(composer);
    fireEvent.change(composer, { target: { value: "Another draft" } });
    mocks.stopTyping.mockClear();
    view.unmount();
    expect(mocks.stopTyping).toHaveBeenCalledWith("64d000000000000000000001");
    vi.useRealTimers();
  });
});
