import {
  createMessageSchema,
  messageHistoryQuerySchema,
  updateMessageSchema,
} from "@intouch/shared/messages";
import { z } from "zod";

const mongoId = (label: string) =>
  z.string().regex(/^[a-f\d]{24}$/i, `${label} must be a valid MongoDB ID`);

export { createMessageSchema, messageHistoryQuerySchema, updateMessageSchema };

export const conversationMessagesParamsSchema = z
  .object({ conversationId: mongoId("Conversation ID") })
  .strict();
export const messageParamsSchema = z
  .object({ messageId: mongoId("Message ID") })
  .strict();
export const messageContextParamsSchema = z
  .object({
    conversationId: mongoId("Conversation ID"),
    messageId: mongoId("Message ID"),
  })
  .strict();

export type ConversationMessagesParams = z.infer<
  typeof conversationMessagesParamsSchema
>;
export type MessageParams = z.infer<typeof messageParamsSchema>;
export type MessageContextParams = z.infer<typeof messageContextParamsSchema>;
