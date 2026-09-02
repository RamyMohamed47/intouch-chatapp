import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { MessageDto } from "@intouch/shared/messages";
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
    attachments: [],
    reactions: [],
    currentUserReaction: null,
  };
  const state: {
    conversationType: "CHANNEL" | "DIRECT";
    currentUserRole: "MEMBER" | "OWNER";
    messages: MessageDto[];
    anchorMessageId: string | null;
    contextHasLater: boolean;
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
    anchorMessageId: null,
    contextHasLater: false,
    peerReadReceipt: null,
    channelReaderSummary: undefined,
  };

  return {
    createdMessage,
    createMessage: vi.fn(() => Promise.resolve(createdMessage)),
    removeMessage: vi.fn(() => Promise.resolve(undefined)),
    state,
    joinConversation: vi.fn(() => Promise.resolve({ success: true })),
    leaveConversation: vi.fn(() => Promise.resolve({ success: true })),
    startTyping: vi.fn(),
    startCall: vi.fn(() => Promise.resolve()),
    stopTyping: vi.fn(),
    routerReplace: vi.fn(),
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

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: mocks.routerReplace }),
  useSearchParams: () =>
    new URLSearchParams(
      mocks.state.anchorMessageId
        ? { messageId: mocks.state.anchorMessageId }
        : undefined,
    ),
}));

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

vi.mock("@/lib/voice/provider", () => ({
  useVoice: () => ({ startCall: mocks.startCall }),
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
  useChatWallpaper: () => ({
    data: {
      wallpaperId: "INTOUCH_DOODLE",
      dimming: 35,
      source: "DEFAULT",
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
  useMessageContext: () => ({
    data: mocks.state.anchorMessageId
      ? {
          anchorMessageId: mocks.state.anchorMessageId,
          messages: mocks.state.messages,
          hasEarlier: true,
          hasLater: mocks.state.contextHasLater,
        }
      : undefined,
    isPending: false,
    isError: false,
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
    remove: mocks.removeMessage,
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
    mocks.state.anchorMessageId = null;
    mocks.state.contextHasLater = false;
    mocks.state.peerReadReceipt = null;
    mocks.state.channelReaderSummary = undefined;
    mocks.createMessage.mockClear();
    mocks.removeMessage.mockReset();
    mocks.removeMessage.mockResolvedValue(undefined);
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

  it("confirms message deletion before sending the request", async () => {
    const user = userEvent.setup();
    mocks.state.messages = [mocks.createdMessage];
    renderConversation();

    await user.click(screen.getByRole("button", { name: "Delete message" }));
    expect(mocks.removeMessage).not.toHaveBeenCalled();

    const dialog = screen.getByRole("dialog", {
      name: "Delete this message?",
    });
    expect(dialog).toHaveTextContent("This action cannot be undone.");
    await user.click(
      within(dialog).getByRole("button", { name: "Delete message" }),
    );

    await waitFor(() =>
      expect(mocks.removeMessage).toHaveBeenCalledWith(mocks.createdMessage.id),
    );
  });

  it("keeps deletion failures visible and hides controls on tombstones", async () => {
    const user = userEvent.setup();
    mocks.state.messages = [mocks.createdMessage];
    mocks.removeMessage.mockRejectedValueOnce(
      new Error("The message could not be deleted"),
    );
    const view = renderConversation();

    await user.click(screen.getByRole("button", { name: "Delete message" }));
    const dialog = screen.getByRole("dialog", {
      name: "Delete this message?",
    });
    await user.click(
      within(dialog).getByRole("button", { name: "Delete message" }),
    );
    expect(await within(dialog).findByRole("alert")).toHaveTextContent(
      "The message could not be deleted",
    );

    view.unmount();
    mocks.state.messages = [
      {
        ...mocks.createdMessage,
        content: null,
        deletedAt: "2026-08-08T10:03:00.000Z",
      },
    ];
    renderConversation();
    expect(
      screen.queryByRole("button", { name: "Delete message" }),
    ).not.toBeInTheDocument();
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

  it("opens exact search context without marking later messages read", async () => {
    mocks.state.messages = [mocks.createdMessage];
    mocks.state.anchorMessageId = mocks.createdMessage.id;
    mocks.state.contextHasLater = true;
    HTMLElement.prototype.scrollIntoView = vi.fn();
    renderConversation();

    expect(
      screen.getByText("Viewing a search result in its conversation context."),
    ).toBeVisible();
    await waitFor(() =>
      expect(
        document.getElementById(`message-${mocks.createdMessage.id}`),
      ).toHaveClass("ring-brand-orange/40"),
    );
    expect(mocks.updateReadReceipt).not.toHaveBeenCalled();

    await userEvent.click(
      screen.getByRole("button", { name: "Jump to latest" }),
    );
    expect(mocks.routerReplace).toHaveBeenCalledWith(
      "/app/64c000000000000000000001/channels/64d000000000000000000001",
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
