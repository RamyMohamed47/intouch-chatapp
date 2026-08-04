"use client";

import {
  createCategorySchema,
  updateCategorySchema,
} from "@intouch/shared/categories";
import {
  createConversationSchema,
  updateConversationSchema,
} from "@intouch/shared/conversations";
import { inviteMemberSchema } from "@intouch/shared/memberships";
import {
  createMessageSchema,
  updateMessageSchema,
} from "@intouch/shared/messages";
import {
  createOrganizationSchema,
  updateOrganizationSchema,
} from "@intouch/shared/organizations";
import { createContext, useContext, useState, type ReactNode } from "react";

import { createDemoState } from "@/lib/demo/fixtures";
import type {
  ConversationVisibility,
  DemoActionResult,
  DemoChannelConversation,
  DemoConversation,
  DemoDirectConversation,
  DemoWorkspaceState,
  OrganizationVisibility,
} from "@/lib/demo/types";

interface CreateOrganizationValues {
  name: string;
  logoUrl?: string;
  visibility: OrganizationVisibility;
}

interface CreateChannelValues {
  categoryId: string;
  name: string;
  visibility: ConversationVisibility;
}

interface DemoWorkspaceContextValue {
  state: DemoWorkspaceState;
  createOrganization: (input: CreateOrganizationValues) => DemoActionResult;
  updateOrganization: (
    organizationId: string,
    input: Partial<Omit<CreateOrganizationValues, "logoUrl">> & {
      logoUrl?: string | null;
    },
  ) => DemoActionResult;
  deleteOrganization: (organizationId: string) => DemoActionResult;
  acceptInvitation: (invitationId: string) => DemoActionResult;
  declineInvitation: (invitationId: string) => DemoActionResult;
  inviteMember: (organizationId: string, email: string) => DemoActionResult;
  createCategory: (organizationId: string, name: string) => DemoActionResult;
  renameCategory: (categoryId: string, name: string) => DemoActionResult;
  moveCategory: (categoryId: string, direction: -1 | 1) => DemoActionResult;
  deleteCategory: (categoryId: string) => DemoActionResult;
  createChannel: (
    organizationId: string,
    input: CreateChannelValues,
  ) => DemoActionResult;
  updateChannel: (
    conversationId: string,
    input: Partial<CreateChannelValues>,
  ) => DemoActionResult;
  deleteChannel: (conversationId: string) => DemoActionResult;
  addParticipant: (conversationId: string, userId: string) => DemoActionResult;
  removeParticipant: (
    conversationId: string,
    userId: string,
  ) => DemoActionResult;
  createDirectMessage: (
    organizationId: string,
    recipientUserId: string,
  ) => DemoActionResult;
  sendMessage: (conversationId: string, content: string) => DemoActionResult;
  editMessage: (messageId: string, content: string) => DemoActionResult;
  deleteMessage: (messageId: string) => DemoActionResult;
}

const DemoWorkspaceContext = createContext<DemoWorkspaceContextValue | null>(
  null,
);

const toError = (error: unknown) => {
  if (error instanceof Error) return error.message;
  return "The demo action could not be completed";
};

const createId = () => {
  const bytes = new Uint8Array(12);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join(
    "",
  );
};

const now = () => new Date().toISOString();
const slugify = (name: string) =>
  name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

export function DemoWorkspaceProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<DemoWorkspaceState>(createDemoState);

  const createOrganization = (
    input: CreateOrganizationValues,
  ): DemoActionResult => {
    try {
      const parsed = createOrganizationSchema.parse(input);
      const id = createId();
      const timestamp = now();

      setState((current) => ({
        ...current,
        organizations: [
          ...current.organizations,
          {
            id,
            name: parsed.name,
            slug: `${slugify(parsed.name)}-${id.slice(-4)}`,
            ...(parsed.logoUrl ? { logoUrl: parsed.logoUrl } : {}),
            visibility: parsed.visibility,
            currentUserRole: "OWNER",
            createdAt: timestamp,
            updatedAt: timestamp,
          },
        ],
        memberships: [
          ...current.memberships,
          {
            membershipId: createId(),
            organizationId: id,
            role: "OWNER",
            joinedAt: timestamp,
            user: {
              ...current.currentUser,
              status: "ONLINE",
              lastSeenAt: null,
            },
          },
        ],
      }));

      return { success: true, id };
    } catch (error) {
      return { success: false, error: toError(error) };
    }
  };

  const updateOrganization: DemoWorkspaceContextValue["updateOrganization"] = (
    organizationId,
    input,
  ) => {
    try {
      const parsed = updateOrganizationSchema.parse(input);
      const organization = state.organizations.find(
        (item) => item.id === organizationId,
      );
      if (!organization)
        return { success: false, error: "Organization not found" };
      if (organization.currentUserRole !== "OWNER") {
        return {
          success: false,
          error: "Only the owner can update this workspace",
        };
      }

      setState((current) => ({
        ...current,
        organizations: current.organizations.map((item) =>
          item.id === organizationId
            ? {
                ...item,
                ...parsed,
                logoUrl:
                  parsed.logoUrl === null
                    ? undefined
                    : (parsed.logoUrl ?? item.logoUrl),
                updatedAt: now(),
              }
            : item,
        ),
      }));
      return { success: true, id: organizationId };
    } catch (error) {
      return { success: false, error: toError(error) };
    }
  };

  const deleteOrganization = (organizationId: string): DemoActionResult => {
    const organization = state.organizations.find(
      (item) => item.id === organizationId,
    );
    if (!organization)
      return { success: false, error: "Organization not found" };
    if (organization.currentUserRole !== "OWNER") {
      return {
        success: false,
        error: "Only the owner can delete this workspace",
      };
    }
    const conversationIds = new Set(
      state.conversations
        .filter((item) => item.organizationId === organizationId)
        .map((item) => item.id),
    );

    setState((current) => ({
      ...current,
      organizations: current.organizations.filter(
        (item) => item.id !== organizationId,
      ),
      memberships: current.memberships.filter(
        (item) => item.organizationId !== organizationId,
      ),
      invitations: current.invitations.filter(
        (item) => item.organizationId !== organizationId,
      ),
      categories: current.categories.filter(
        (item) => item.organizationId !== organizationId,
      ),
      conversations: current.conversations.filter(
        (item) => item.organizationId !== organizationId,
      ),
      messages: current.messages.filter(
        (item) => !conversationIds.has(item.conversationId),
      ),
    }));
    return { success: true };
  };

  const acceptInvitation = (invitationId: string): DemoActionResult => {
    const invitation = state.invitations.find(
      (item) => item.id === invitationId,
    );
    if (!invitation) return { success: false, error: "Invitation not found" };
    const organization = state.organizations.find(
      (item) => item.id === invitation.organizationId,
    );
    if (!organization)
      return { success: false, error: "Organization not found" };

    setState((current) => ({
      ...current,
      organizations: current.organizations.map((item) =>
        item.id === invitation.organizationId
          ? { ...item, currentUserRole: item.currentUserRole ?? "MEMBER" }
          : item,
      ),
      memberships: current.memberships.some(
        (item) =>
          item.organizationId === invitation.organizationId &&
          item.user.id === current.currentUser.id,
      )
        ? current.memberships
        : [
            ...current.memberships,
            {
              membershipId: createId(),
              organizationId: invitation.organizationId,
              role: "MEMBER",
              joinedAt: now(),
              user: {
                ...current.currentUser,
                status: "ONLINE",
                lastSeenAt: null,
              },
            },
          ],
      invitations: current.invitations.filter(
        (item) => item.id !== invitationId,
      ),
    }));
    return { success: true, id: invitation.organizationId };
  };

  const declineInvitation = (invitationId: string): DemoActionResult => {
    if (!state.invitations.some((item) => item.id === invitationId)) {
      return { success: false, error: "Invitation not found" };
    }
    setState((current) => ({
      ...current,
      invitations: current.invitations.filter(
        (item) => item.id !== invitationId,
      ),
    }));
    return { success: true };
  };

  const inviteMember = (
    organizationId: string,
    email: string,
  ): DemoActionResult => {
    try {
      const parsed = inviteMemberSchema.parse({ email });
      const organization = state.organizations.find(
        (item) => item.id === organizationId,
      );
      if (organization?.currentUserRole !== "OWNER") {
        return { success: false, error: "Only the owner can invite members" };
      }
      const target = state.memberships
        .map((item) => item.user)
        .find((user) => user.email === parsed.email);
      if (!target) {
        return {
          success: false,
          error: "Use an existing demo user email, such as sam@intouch.demo",
        };
      }
      if (
        state.memberships.some(
          (item) =>
            item.organizationId === organizationId &&
            item.user.id === target.id,
        )
      ) {
        return { success: false, error: "That person is already a member" };
      }
      if (
        state.invitations.some(
          (item) =>
            item.organizationId === organizationId &&
            item.invitedUserId === target.id,
        )
      ) {
        return { success: false, error: "An invitation is already pending" };
      }

      setState((current) => ({
        ...current,
        invitations: [
          ...current.invitations,
          {
            id: createId(),
            organizationId,
            invitedUserId: target.id,
            invitedByUserId: current.currentUser.id,
            createdAt: now(),
            expiresAt: new Date(
              Date.now() + 7 * 24 * 60 * 60 * 1000,
            ).toISOString(),
          },
        ],
      }));
      return { success: true };
    } catch (error) {
      return { success: false, error: toError(error) };
    }
  };

  const createCategory = (
    organizationId: string,
    name: string,
  ): DemoActionResult => {
    try {
      const parsed = createCategorySchema.parse({ name });
      const duplicate = state.categories.some(
        (item) =>
          item.organizationId === organizationId &&
          item.name.toLowerCase() === parsed.name.toLowerCase(),
      );
      if (duplicate)
        return { success: false, error: "Category name already exists" };
      const id = createId();
      const timestamp = now();
      const position = state.categories.filter(
        (item) => item.organizationId === organizationId,
      ).length;
      setState((current) => ({
        ...current,
        categories: [
          ...current.categories,
          {
            id,
            organizationId,
            name: parsed.name,
            position,
            createdAt: timestamp,
            updatedAt: timestamp,
          },
        ],
      }));
      return { success: true, id };
    } catch (error) {
      return { success: false, error: toError(error) };
    }
  };

  const renameCategory = (
    categoryId: string,
    name: string,
  ): DemoActionResult => {
    try {
      const parsed = updateCategorySchema.parse({ name });
      const category = state.categories.find((item) => item.id === categoryId);
      if (!category) return { success: false, error: "Category not found" };
      if (
        state.categories.some(
          (item) =>
            item.id !== categoryId &&
            item.organizationId === category.organizationId &&
            item.name.toLowerCase() === parsed.name?.toLowerCase(),
        )
      ) {
        return { success: false, error: "Category name already exists" };
      }
      setState((current) => ({
        ...current,
        categories: current.categories.map((item) =>
          item.id === categoryId
            ? { ...item, name: parsed.name ?? item.name, updatedAt: now() }
            : item,
        ),
      }));
      return { success: true };
    } catch (error) {
      return { success: false, error: toError(error) };
    }
  };

  const moveCategory = (
    categoryId: string,
    direction: -1 | 1,
  ): DemoActionResult => {
    const category = state.categories.find((item) => item.id === categoryId);
    if (!category) return { success: false, error: "Category not found" };
    const ordered = state.categories
      .filter((item) => item.organizationId === category.organizationId)
      .sort((a, b) => a.position - b.position);
    const index = ordered.findIndex((item) => item.id === categoryId);
    const target = ordered[index + direction];
    if (!target) return { success: true };
    setState((current) => ({
      ...current,
      categories: current.categories.map((item) => {
        if (item.id === category.id)
          return { ...item, position: target.position };
        if (item.id === target.id)
          return { ...item, position: category.position };
        return item;
      }),
    }));
    return { success: true };
  };

  const deleteCategory = (categoryId: string): DemoActionResult => {
    if (
      state.conversations.some(
        (item) => item.type === "CHANNEL" && item.categoryId === categoryId,
      )
    ) {
      return { success: false, error: "Move or delete its channels first" };
    }
    setState((current) => ({
      ...current,
      categories: current.categories.filter((item) => item.id !== categoryId),
    }));
    return { success: true };
  };

  const createChannel = (
    organizationId: string,
    input: CreateChannelValues,
  ): DemoActionResult => {
    try {
      const parsed = createConversationSchema.parse(input);
      if (
        state.conversations.some(
          (item) =>
            item.type === "CHANNEL" &&
            item.categoryId === parsed.categoryId &&
            item.name.toLowerCase() === parsed.name.toLowerCase(),
        )
      ) {
        return {
          success: false,
          error: "Channel name already exists in this category",
        };
      }
      const id = createId();
      const timestamp = now();
      const position = state.conversations.filter(
        (item) =>
          item.type === "CHANNEL" && item.categoryId === parsed.categoryId,
      ).length;
      const channel: DemoChannelConversation = {
        id,
        organizationId,
        categoryId: parsed.categoryId,
        type: "CHANNEL",
        name: parsed.name,
        visibility: parsed.visibility,
        position,
        participantIds:
          parsed.visibility === "PRIVATE" ? [state.currentUser.id] : [],
        unreadCount: 0,
        readReceipt: null,
        createdAt: timestamp,
        updatedAt: timestamp,
      };
      setState((current) => ({
        ...current,
        conversations: [...current.conversations, channel],
      }));
      return { success: true, id };
    } catch (error) {
      return { success: false, error: toError(error) };
    }
  };

  const updateChannel = (
    conversationId: string,
    input: Partial<CreateChannelValues>,
  ): DemoActionResult => {
    try {
      const parsed = updateConversationSchema.parse(input);
      const conversation = state.conversations.find(
        (item): item is DemoChannelConversation =>
          item.id === conversationId && item.type === "CHANNEL",
      );
      if (!conversation) return { success: false, error: "Channel not found" };
      setState((current) => ({
        ...current,
        conversations: current.conversations.map((item): DemoConversation => {
          if (item.id !== conversationId || item.type !== "CHANNEL")
            return item;
          const visibility = parsed.visibility ?? item.visibility;
          return {
            ...item,
            ...parsed,
            visibility,
            participantIds:
              visibility === "PUBLIC"
                ? []
                : item.visibility === "PUBLIC"
                  ? [current.currentUser.id]
                  : item.participantIds,
            updatedAt: now(),
          };
        }),
      }));
      return { success: true };
    } catch (error) {
      return { success: false, error: toError(error) };
    }
  };

  const deleteChannel = (conversationId: string): DemoActionResult => {
    setState((current) => ({
      ...current,
      conversations: current.conversations.filter(
        (item) => item.id !== conversationId,
      ),
      messages: current.messages.filter(
        (item) => item.conversationId !== conversationId,
      ),
    }));
    return { success: true };
  };

  const addParticipant = (
    conversationId: string,
    userId: string,
  ): DemoActionResult => {
    const conversation = state.conversations.find(
      (item) => item.id === conversationId,
    );
    if (
      conversation?.type !== "CHANNEL" ||
      conversation.visibility !== "PRIVATE"
    ) {
      return {
        success: false,
        error: "Participants apply to private channels only",
      };
    }
    if (conversation.participantIds.includes(userId)) {
      return { success: false, error: "That member already has access" };
    }
    setState((current) => ({
      ...current,
      conversations: current.conversations.map((item) =>
        item.id === conversationId && item.type === "CHANNEL"
          ? { ...item, participantIds: [...item.participantIds, userId] }
          : item,
      ),
    }));
    return { success: true };
  };

  const removeParticipant = (
    conversationId: string,
    userId: string,
  ): DemoActionResult => {
    if (userId === state.currentUser.id) {
      return {
        success: false,
        error: "The organization owner cannot be removed",
      };
    }
    setState((current) => ({
      ...current,
      conversations: current.conversations.map((item) =>
        item.id === conversationId && item.type === "CHANNEL"
          ? {
              ...item,
              participantIds: item.participantIds.filter((id) => id !== userId),
            }
          : item,
      ),
    }));
    return { success: true };
  };

  const createDirectMessage = (
    organizationId: string,
    recipientUserId: string,
  ): DemoActionResult => {
    if (recipientUserId === state.currentUser.id) {
      return { success: false, error: "Choose another member" };
    }
    const existing = state.conversations.find(
      (item) =>
        item.type === "DIRECT" &&
        item.organizationId === organizationId &&
        item.participantIds.includes(state.currentUser.id) &&
        item.participantIds.includes(recipientUserId),
    );
    if (existing) return { success: true, id: existing.id };
    const id = createId();
    const timestamp = now();
    const direct: DemoDirectConversation = {
      id,
      organizationId,
      type: "DIRECT",
      participantIds: [state.currentUser.id, recipientUserId],
      unreadCount: 0,
      readReceipt: null,
      createdAt: timestamp,
      updatedAt: timestamp,
    };
    setState((current) => ({
      ...current,
      conversations: [...current.conversations, direct],
    }));
    return { success: true, id };
  };

  const sendMessage = (
    conversationId: string,
    content: string,
  ): DemoActionResult => {
    try {
      const parsed = createMessageSchema.parse({ content });
      const id = createId();
      const timestamp = now();
      setState((current) => ({
        ...current,
        messages: [
          ...current.messages,
          {
            id,
            conversationId,
            senderId: current.currentUser.id,
            content: parsed.content,
            messageType: "TEXT",
            createdAt: timestamp,
            updatedAt: timestamp,
            editedAt: null,
            deletedAt: null,
          },
        ],
        conversations: current.conversations.map((item) =>
          item.id === conversationId
            ? { ...item, updatedAt: timestamp, unreadCount: 0 }
            : item,
        ),
      }));
      return { success: true, id };
    } catch (error) {
      return { success: false, error: toError(error) };
    }
  };

  const editMessage = (
    messageId: string,
    content: string,
  ): DemoActionResult => {
    try {
      const parsed = updateMessageSchema.parse({ content });
      const timestamp = now();
      setState((current) => ({
        ...current,
        messages: current.messages.map((item) =>
          item.id === messageId && item.senderId === current.currentUser.id
            ? {
                ...item,
                content: parsed.content,
                updatedAt: timestamp,
                editedAt: timestamp,
              }
            : item,
        ),
      }));
      return { success: true };
    } catch (error) {
      return { success: false, error: toError(error) };
    }
  };

  const deleteMessage = (messageId: string): DemoActionResult => {
    const message = state.messages.find((item) => item.id === messageId);
    if (!message) return { success: false, error: "Message not found" };
    const conversation = state.conversations.find(
      (item) => item.id === message.conversationId,
    );
    const organization = state.organizations.find(
      (item) => item.id === conversation?.organizationId,
    );
    const canDelete =
      message.senderId === state.currentUser.id ||
      (conversation?.type === "CHANNEL" &&
        organization?.currentUserRole === "OWNER");
    if (!canDelete)
      return { success: false, error: "You cannot delete this message" };
    const timestamp = now();
    setState((current) => ({
      ...current,
      messages: current.messages.map((item) =>
        item.id === messageId
          ? {
              ...item,
              content: null,
              deletedAt: item.deletedAt ?? timestamp,
              updatedAt: timestamp,
            }
          : item,
      ),
    }));
    return { success: true };
  };

  return (
    <DemoWorkspaceContext.Provider
      value={{
        state,
        createOrganization,
        updateOrganization,
        deleteOrganization,
        acceptInvitation,
        declineInvitation,
        inviteMember,
        createCategory,
        renameCategory,
        moveCategory,
        deleteCategory,
        createChannel,
        updateChannel,
        deleteChannel,
        addParticipant,
        removeParticipant,
        createDirectMessage,
        sendMessage,
        editMessage,
        deleteMessage,
      }}
    >
      {children}
    </DemoWorkspaceContext.Provider>
  );
}

export const useDemoWorkspace = () => {
  const context = useContext(DemoWorkspaceContext);
  if (!context) {
    throw new Error(
      "useDemoWorkspace must be used within DemoWorkspaceProvider",
    );
  }
  return context;
};
