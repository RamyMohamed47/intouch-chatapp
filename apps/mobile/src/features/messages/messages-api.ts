import {
  messageListResponseSchema,
  messageReadReceiptSummaryResponseSchema,
  messageReactionStateResponseSchema,
  messageReactionUsersResponseSchema,
  messageResponseSchema,
  readReceiptResponseSchema,
  type CreateMessageInput,
  type SetMessageReactionInput,
  type UpdateMessageInput,
} from "@intouch/shared/messages";

import { apiRequest, noContentSchema } from "@/core/api/client";

export const messagesApi = {
  list: (conversationId: string, before?: string) => {
    const query = new URLSearchParams({ limit: "40" });
    if (before) query.set("before", before);
    return apiRequest(
      `/api/v1/conversations/${conversationId}/messages?${query.toString()}`,
      messageListResponseSchema,
    );
  },
  create: async (conversationId: string, input: CreateMessageInput) =>
    (
      await apiRequest(
        `/api/v1/conversations/${conversationId}/messages`,
        messageResponseSchema,
        { method: "POST", body: JSON.stringify(input) },
      )
    ).message,
  update: async (id: string, input: UpdateMessageInput) =>
    (
      await apiRequest(`/api/v1/messages/${id}`, messageResponseSchema, {
        method: "PATCH",
        body: JSON.stringify(input),
      })
    ).message,
  remove: (id: string) =>
    apiRequest(`/api/v1/messages/${id}`, noContentSchema, {
      method: "DELETE",
    }),
  receipt: async (conversationId: string, messageId: string) =>
    (
      await apiRequest(
        `/api/v1/conversations/${conversationId}/read-receipt`,
        readReceiptResponseSchema,
        {
          method: "PUT",
          body: JSON.stringify({ messageId }),
        },
      )
    ).readReceipt,
  readers: async (conversationId: string, messageId: string) =>
    (
      await apiRequest(
        `/api/v1/conversations/${conversationId}/messages/${messageId}/readers`,
        messageReadReceiptSummaryResponseSchema,
      )
    ).readReceiptSummary,
  reactionState: async (messageId: string) =>
    (
      await apiRequest(
        `/api/v1/messages/${messageId}/reactions`,
        messageReactionStateResponseSchema,
      )
    ).reactionState,
  setReaction: async (messageId: string, input: SetMessageReactionInput) =>
    (
      await apiRequest(
        `/api/v1/messages/${messageId}/reactions/me`,
        messageReactionStateResponseSchema,
        { method: "PUT", body: JSON.stringify(input) },
      )
    ).reactionState,
  removeReaction: async (messageId: string) =>
    (
      await apiRequest(
        `/api/v1/messages/${messageId}/reactions/me`,
        messageReactionStateResponseSchema,
        { method: "DELETE" },
      )
    ).reactionState,
  reactionUsers: (messageId: string, emoji: string, before?: string) => {
    const query = new URLSearchParams({ emoji, limit: "30" });
    if (before) query.set("before", before);
    return apiRequest(
      `/api/v1/messages/${messageId}/reactions/users?${query.toString()}`,
      messageReactionUsersResponseSchema,
    );
  },
};
