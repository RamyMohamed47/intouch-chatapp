import {
  conversationListResponseSchema,
  conversationResponseSchema,
  directMessageListResponseSchema,
  directMessageResponseSchema,
  participantListResponseSchema,
  participantResponseSchema,
  type AddConversationParticipantInput,
  type CreateConversationInput,
  type CreateDirectMessageInput,
  type UpdateConversationInput,
} from "@intouch/shared/conversations";

import { apiRequest, noContentSchema } from "@/core/api/client";

export const conversationsApi = {
  channels: async (organizationId: string) =>
    (
      await apiRequest(
        `/api/v1/organizations/${organizationId}/conversations`,
        conversationListResponseSchema,
      )
    ).conversations,
  directMessages: (organizationId: string, before?: string) => {
    const query = new URLSearchParams({ limit: "30" });
    if (before) query.set("before", before);
    return apiRequest(
      `/api/v1/organizations/${organizationId}/direct-messages?${query.toString()}`,
      directMessageListResponseSchema,
    );
  },
  get: async (id: string) =>
    (
      await apiRequest(
        `/api/v1/conversations/${id}`,
        conversationResponseSchema,
      )
    ).conversation,
  createChannel: async (
    organizationId: string,
    input: CreateConversationInput,
  ) =>
    (
      await apiRequest(
        `/api/v1/organizations/${organizationId}/conversations`,
        conversationResponseSchema,
        { method: "POST", body: JSON.stringify(input) },
      )
    ).conversation,
  update: async (id: string, input: UpdateConversationInput) =>
    (
      await apiRequest(
        `/api/v1/conversations/${id}`,
        conversationResponseSchema,
        { method: "PATCH", body: JSON.stringify(input) },
      )
    ).conversation,
  remove: (id: string) =>
    apiRequest(`/api/v1/conversations/${id}`, noContentSchema, {
      method: "DELETE",
    }),
  createDirectMessage: async (
    organizationId: string,
    input: CreateDirectMessageInput,
  ) =>
    (
      await apiRequest(
        `/api/v1/organizations/${organizationId}/direct-messages`,
        directMessageResponseSchema,
        { method: "POST", body: JSON.stringify(input) },
      )
    ).directMessage,
  participants: async (id: string) =>
    (
      await apiRequest(
        `/api/v1/conversations/${id}/participants`,
        participantListResponseSchema,
      )
    ).participants,
  addParticipant: async (id: string, input: AddConversationParticipantInput) =>
    (
      await apiRequest(
        `/api/v1/conversations/${id}/participants`,
        participantResponseSchema,
        { method: "POST", body: JSON.stringify(input) },
      )
    ).participant,
  removeParticipant: (id: string, userId: string) =>
    apiRequest(
      `/api/v1/conversations/${id}/participants/${userId}`,
      noContentSchema,
      { method: "DELETE" },
    ),
};
