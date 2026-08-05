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

import { apiRequest, noContentSchema } from "@/lib/api/client";

export const conversationsApi = {
  async listChannels(organizationId: string, categoryId?: string) {
    const query = categoryId
      ? `?${new URLSearchParams({ categoryId }).toString()}`
      : "";
    return (
      await apiRequest(
        `/api/v1/organizations/${organizationId}/conversations${query}`,
        conversationListResponseSchema,
      )
    ).conversations;
  },
  async get(conversationId: string) {
    return (
      await apiRequest(
        `/api/v1/conversations/${conversationId}`,
        conversationResponseSchema,
      )
    ).conversation;
  },
  async createChannel(organizationId: string, input: CreateConversationInput) {
    return (
      await apiRequest(
        `/api/v1/organizations/${organizationId}/conversations`,
        conversationResponseSchema,
        { method: "POST", body: JSON.stringify(input) },
      )
    ).conversation;
  },
  async update(conversationId: string, input: UpdateConversationInput) {
    return (
      await apiRequest(
        `/api/v1/conversations/${conversationId}`,
        conversationResponseSchema,
        { method: "PATCH", body: JSON.stringify(input) },
      )
    ).conversation;
  },
  remove(conversationId: string) {
    return apiRequest(
      `/api/v1/conversations/${conversationId}`,
      noContentSchema,
      { method: "DELETE" },
    );
  },
  async listDirectMessages(
    organizationId: string,
    options: { before?: string; limit?: number } = {},
  ) {
    const query = new URLSearchParams();
    if (options.before) query.set("before", options.before);
    if (options.limit) query.set("limit", String(options.limit));
    const suffix = query.size ? `?${query.toString()}` : "";
    return apiRequest(
      `/api/v1/organizations/${organizationId}/direct-messages${suffix}`,
      directMessageListResponseSchema,
    );
  },
  async createDirectMessage(
    organizationId: string,
    input: CreateDirectMessageInput,
  ) {
    return (
      await apiRequest(
        `/api/v1/organizations/${organizationId}/direct-messages`,
        directMessageResponseSchema,
        { method: "POST", body: JSON.stringify(input) },
      )
    ).directMessage;
  },
  async listParticipants(conversationId: string) {
    return (
      await apiRequest(
        `/api/v1/conversations/${conversationId}/participants`,
        participantListResponseSchema,
      )
    ).participants;
  },
  async addParticipant(
    conversationId: string,
    input: AddConversationParticipantInput,
  ) {
    return (
      await apiRequest(
        `/api/v1/conversations/${conversationId}/participants`,
        participantResponseSchema,
        { method: "POST", body: JSON.stringify(input) },
      )
    ).participant;
  },
  removeParticipant(conversationId: string, userId: string) {
    return apiRequest(
      `/api/v1/conversations/${conversationId}/participants/${userId}`,
      noContentSchema,
      { method: "DELETE" },
    );
  },
};
