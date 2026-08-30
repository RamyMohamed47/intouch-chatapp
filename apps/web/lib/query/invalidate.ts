import type { QueryClient } from "@tanstack/react-query";

import { queryKeys } from "@/lib/query/keys";

export const invalidateOrganizationNavigation = (
  queryClient: QueryClient,
  organizationId: string,
) =>
  Promise.all([
    queryClient.invalidateQueries({ queryKey: queryKeys.organizations.all }),
    queryClient.invalidateQueries({
      queryKey: queryKeys.organizations.detail(organizationId),
    }),
    queryClient.invalidateQueries({
      queryKey: queryKeys.categories.list(organizationId),
    }),
    queryClient.invalidateQueries({
      queryKey: queryKeys.conversations.channels(organizationId),
    }),
    queryClient.invalidateQueries({
      queryKey: queryKeys.conversations.directMessages(organizationId),
    }),
    queryClient.invalidateQueries({
      queryKey: queryKeys.conversations.directMessagePreview(organizationId),
    }),
  ]);

export const invalidateOrganizationBranding = (
  queryClient: QueryClient,
  organizationId: string,
) =>
  Promise.all([
    queryClient.invalidateQueries({ queryKey: queryKeys.organizations.all }),
    queryClient.invalidateQueries({
      queryKey: queryKeys.organizations.detail(organizationId),
    }),
    queryClient.invalidateQueries({ queryKey: queryKeys.invitations.all }),
    queryClient.invalidateQueries({ queryKey: queryKeys.notifications.all }),
  ]);

export const invalidateConversation = (
  queryClient: QueryClient,
  conversationId: string,
) =>
  Promise.all([
    queryClient.invalidateQueries({
      queryKey: queryKeys.conversations.detail(conversationId),
    }),
    queryClient.invalidateQueries({
      queryKey: queryKeys.conversations.messages(conversationId),
    }),
  ]);
