import {
  messageListResponseSchema,
  messageResponseSchema,
  readReceiptResponseSchema,
  type CreateMessageInput,
  type UpdateMessageInput,
  type UpdateReadReceiptInput,
} from "@intouch/shared/messages";

import { apiRequest, noContentSchema } from "@/lib/api/client";

export const messagesApi = {
  list(conversationId: string, before?: string, limit = 50) {
    const query = new URLSearchParams({ limit: String(limit) });
    if (before) query.set("before", before);
    return apiRequest(
      `/api/v1/conversations/${conversationId}/messages?${query.toString()}`,
      messageListResponseSchema,
    );
  },
  async create(conversationId: string, input: CreateMessageInput) {
    return (
      await apiRequest(
        `/api/v1/conversations/${conversationId}/messages`,
        messageResponseSchema,
        { method: "POST", body: JSON.stringify(input) },
      )
    ).message;
  },
  async update(messageId: string, input: UpdateMessageInput) {
    return (
      await apiRequest(`/api/v1/messages/${messageId}`, messageResponseSchema, {
        method: "PATCH",
        body: JSON.stringify(input),
      })
    ).message;
  },
  remove(messageId: string) {
    return apiRequest(`/api/v1/messages/${messageId}`, noContentSchema, {
      method: "DELETE",
    });
  },
  async updateReadReceipt(
    conversationId: string,
    input: UpdateReadReceiptInput,
  ) {
    return (
      await apiRequest(
        `/api/v1/conversations/${conversationId}/read-receipt`,
        readReceiptResponseSchema,
        { method: "PUT", body: JSON.stringify(input) },
      )
    ).readReceipt;
  },
};
