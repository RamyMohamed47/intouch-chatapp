"use client";

import { useInfiniteQuery, useQuery } from "@tanstack/react-query";

import { categoriesApi } from "@/lib/api/categories";
import { conversationsApi } from "@/lib/api/conversations";
import { membershipsApi } from "@/lib/api/memberships";
import { messagesApi } from "@/lib/api/messages";
import { organizationsApi } from "@/lib/api/organizations";
import { queryKeys } from "@/lib/query/keys";

export const useOrganizations = () =>
  useQuery({
    queryKey: queryKeys.organizations.all,
    queryFn: () => organizationsApi.list(),
  });

export const useOrganization = (organizationId: string) =>
  useQuery({
    queryKey: queryKeys.organizations.detail(organizationId),
    queryFn: () => organizationsApi.get(organizationId),
    enabled: Boolean(organizationId),
  });

export const useInvitations = () =>
  useQuery({
    queryKey: queryKeys.invitations.all,
    queryFn: () => membershipsApi.listInvitations(),
  });

export const useCategories = (organizationId: string, enabled = true) =>
  useQuery({
    queryKey: queryKeys.categories.list(organizationId),
    queryFn: () => categoriesApi.list(organizationId),
    enabled: enabled && Boolean(organizationId),
  });

export const useMembers = (organizationId: string, enabled = true) =>
  useQuery({
    queryKey: queryKeys.members.list(organizationId),
    queryFn: () => membershipsApi.listMembers(organizationId),
    enabled: enabled && Boolean(organizationId),
  });

export const useChannels = (organizationId: string, enabled = true) =>
  useQuery({
    queryKey: queryKeys.conversations.channels(organizationId),
    queryFn: () => conversationsApi.listChannels(organizationId),
    enabled: enabled && Boolean(organizationId),
  });

export const useDirectMessages = (organizationId: string, enabled = true) =>
  useInfiniteQuery({
    queryKey: queryKeys.conversations.directMessages(organizationId),
    queryFn: ({ pageParam }) =>
      conversationsApi.listDirectMessages(organizationId, {
        before: pageParam,
        limit: 30,
      }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (page) => page.nextCursor ?? undefined,
    enabled: enabled && Boolean(organizationId),
  });

export const useConversation = (conversationId: string) =>
  useQuery({
    queryKey: queryKeys.conversations.detail(conversationId),
    queryFn: () => conversationsApi.get(conversationId),
    enabled: Boolean(conversationId),
  });

export const useParticipants = (conversationId: string, enabled = true) =>
  useQuery({
    queryKey: queryKeys.conversations.participants(conversationId),
    queryFn: () => conversationsApi.listParticipants(conversationId),
    enabled: enabled && Boolean(conversationId),
  });

export const useMessages = (conversationId: string) =>
  useInfiniteQuery({
    queryKey: queryKeys.conversations.messages(conversationId),
    queryFn: ({ pageParam }) => messagesApi.list(conversationId, pageParam),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (page) => page.nextCursor ?? undefined,
    enabled: Boolean(conversationId),
  });

export const useMessageReaders = (
  conversationId: string,
  messageId: string,
  enabled = true,
) =>
  useQuery({
    queryKey: queryKeys.conversations.messageReaders(conversationId, messageId),
    queryFn: () => messagesApi.listReaders(conversationId, messageId),
    enabled: enabled && Boolean(conversationId) && Boolean(messageId),
  });
