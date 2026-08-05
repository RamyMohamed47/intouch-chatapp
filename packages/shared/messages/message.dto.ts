import { z } from "zod";

import { dateTimeDtoSchema, identifierDtoSchema } from "../common/index.js";

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

export type MessageTypeValue = z.infer<typeof messageTypeSchema>;
export type MessageDto = z.infer<typeof messageDtoSchema>;
export type MessageResponse = z.infer<typeof messageResponseSchema>;
export type MessageListResponse = z.infer<typeof messageListResponseSchema>;
export type ReadReceiptDto = z.infer<typeof readReceiptDtoSchema>;
export type ReadReceiptResponse = z.infer<typeof readReceiptResponseSchema>;
