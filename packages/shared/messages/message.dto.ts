import { z } from "zod";

import { dateTimeDtoSchema, identifierDtoSchema } from "../common/index.js";
import { publicUserSummaryDtoSchema } from "../users/index.js";

export const MessageType = {
  TEXT: "TEXT",
} as const;

export const messageTypeSchema = z.enum(MessageType);

export const messageDtoSchema = z.object({
  id: identifierDtoSchema,
  conversationId: identifierDtoSchema,
  senderId: identifierDtoSchema,
  content: z.string().nullable(),
  messageType: messageTypeSchema,
  editedAt: dateTimeDtoSchema.nullable(),
  deletedAt: dateTimeDtoSchema.nullable(),
  createdAt: dateTimeDtoSchema,
  updatedAt: dateTimeDtoSchema,
});

export const messageResponseSchema = z.object({
  message: messageDtoSchema,
});

export const messageListResponseSchema = z.object({
  messages: z.array(messageDtoSchema),
  nextCursor: z.string().nullable(),
});

export const readReceiptDtoSchema = z.object({
  id: identifierDtoSchema,
  conversationId: identifierDtoSchema,
  userId: identifierDtoSchema,
  lastReadMessageId: identifierDtoSchema,
  lastReadAt: dateTimeDtoSchema,
});

export const readReceiptResponseSchema = z.object({
  readReceipt: readReceiptDtoSchema,
});

export const messageReadReceiptSummaryDtoSchema = z.object({
  messageId: identifierDtoSchema,
  readByCount: z.number().int().nonnegative(),
  readers: z.array(publicUserSummaryDtoSchema).max(3),
});

export const messageReadReceiptSummaryResponseSchema = z.object({
  readReceiptSummary: messageReadReceiptSummaryDtoSchema,
});

export type MessageTypeValue = z.infer<typeof messageTypeSchema>;
export type MessageDto = z.infer<typeof messageDtoSchema>;
export type MessageResponse = z.infer<typeof messageResponseSchema>;
export type MessageListResponse = z.infer<typeof messageListResponseSchema>;
export type ReadReceiptDto = z.infer<typeof readReceiptDtoSchema>;
export type ReadReceiptResponse = z.infer<typeof readReceiptResponseSchema>;
export type MessageReadReceiptSummaryDto = z.infer<
  typeof messageReadReceiptSummaryDtoSchema
>;
export type MessageReadReceiptSummaryResponse = z.infer<
  typeof messageReadReceiptSummaryResponseSchema
>;
