import type {
  DemoChannelConversation,
  DemoConversation,
  DemoDirectConversation,
  DemoMessage,
  DemoWorkspaceState,
} from "@/lib/demo/types";

export const getOrganization = (
  state: DemoWorkspaceState,
  organizationId: string,
) => state.organizations.find((item) => item.id === organizationId);

export const getOrganizationCategories = (
  state: DemoWorkspaceState,
  organizationId: string,
) =>
  state.categories
    .filter((item) => item.organizationId === organizationId)
    .sort((a, b) => a.position - b.position);

export const getOrganizationChannels = (
  state: DemoWorkspaceState,
  organizationId: string,
) =>
  state.conversations
    .filter(
      (item): item is DemoChannelConversation =>
        item.organizationId === organizationId && item.type === "CHANNEL",
    )
    .sort((a, b) => a.position - b.position);

export const getOrganizationDirectMessages = (
  state: DemoWorkspaceState,
  organizationId: string,
) =>
  state.conversations
    .filter(
      (item): item is DemoDirectConversation =>
        item.organizationId === organizationId && item.type === "DIRECT",
    )
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));

export const getOrganizationMembers = (
  state: DemoWorkspaceState,
  organizationId: string,
) => state.memberships.filter((item) => item.organizationId === organizationId);

export const getConversation = (
  state: DemoWorkspaceState,
  conversationId: string,
) => state.conversations.find((item) => item.id === conversationId);

export const getConversationMessages = (
  state: DemoWorkspaceState,
  conversationId: string,
) =>
  state.messages
    .filter((item) => item.conversationId === conversationId)
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));

export const getLastMessage = (
  state: DemoWorkspaceState,
  conversation: DemoConversation,
): DemoMessage | undefined =>
  getConversationMessages(state, conversation.id).at(-1);

export const getDirectPeer = (
  state: DemoWorkspaceState,
  conversation: DemoConversation,
) => {
  if (conversation.type !== "DIRECT") return undefined;
  const peerId = conversation.participantIds.find(
    (id) => id !== state.currentUser.id,
  );
  return state.memberships
    .map((item) => item.user)
    .find((user) => user.id === peerId);
};

export const getUser = (state: DemoWorkspaceState, userId: string) =>
  state.memberships
    .map((item) => item.user)
    .find((user) => user.id === userId) ??
  (state.currentUser.id === userId ? state.currentUser : undefined);
