import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
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
  const state: { currentUserRole: "MEMBER" | "OWNER" } = {
    currentUserRole: "OWNER",
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
    readReceipt: () => null,
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
    data: {
      id: "64d000000000000000000001",
      organizationId: "64c000000000000000000001",
      categoryId: "64e000000000000000000001",
      name: "general",
      type: "CHANNEL",
      visibility: "PUBLIC",
      position: 0,
      createdAt: "2026-08-01T10:00:00.000Z",
      updatedAt: "2026-08-01T10:00:00.000Z",
    },
    isPending: false,
    isError: false,
  }),
  useMessages: () => ({
    data: { pages: [{ messages: [], nextCursor: null }] },
    isPending: false,
    isError: false,
    hasNextPage: false,
    isFetchingNextPage: false,
    fetchNextPage: vi.fn(),
    refetch: vi.fn(),
  }),
  useMembers: () => ({ data: [], isPending: false, isError: false }),
}));

vi.mock("@/lib/api/messages", () => ({
  messagesApi: {
    create: mocks.createMessage,
    update: vi.fn(),
    remove: vi.fn(),
    updateReadReceipt: mocks.updateReadReceipt,
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
        expectedType="CHANNEL"
      />
    </QueryClientProvider>,
  );
};

describe("ConversationPage interactions", () => {
  beforeEach(() => {
    mocks.state.currentUserRole = "OWNER";
    mocks.createMessage.mockClear();
  });

  afterEach(() => vi.clearAllMocks());

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
});
