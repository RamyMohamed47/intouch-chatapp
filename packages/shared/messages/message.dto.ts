import { z } from "zod";

import { dateTimeDtoSchema, identifierDtoSchema } from "../common/index.js";
import { publicUserSummaryDtoSchema } from "../users/index.js";
import { attachmentDtoSchema } from "../uploads/index.js";

export const MessageType = {
  TEXT: "TEXT",
  ATTACHMENT: "ATTACHMENT",
} as const;

export const messageTypeSchema = z.enum(MessageType);

export const messageCoreDtoSchema = z.object({
  id: identifierDtoSchema,
  conversationId: identifierDtoSchema,
  senderId: identifierDtoSchema,
  content: z.string().nullable(),
  messageType: messageTypeSchema,
  editedAt: dateTimeDtoSchema.nullable(),
  deletedAt: dateTimeDtoSchema.nullable(),
  createdAt: dateTimeDtoSchema,
  updatedAt: dateTimeDtoSchema,
  attachments: z.array(attachmentDtoSchema).default([]),
});

export const messageReactionSummaryDtoSchema = z
  .object({
    emoji: z.string().min(1),
    count: z.number().int().positive(),
  })
  .strict();

export const messageReactionStateDtoSchema = z
  .object({
    messageId: identifierDtoSchema,
    reactions: z.array(messageReactionSummaryDtoSchema),
    currentUserReaction: z.string().min(1).nullable(),
  })
  .strict();

export const messageDtoSchema = messageCoreDtoSchema.extend({
  reactions: z.array(messageReactionSummaryDtoSchema),
  currentUserReaction: z.string().min(1).nullable(),
});

export const messageResponseSchema = z.object({
  message: messageDtoSchema,
});

export const messageListResponseSchema = z.object({
  messages: z.array(messageDtoSchema),
  nextCursor: z.string().nullable(),
});

export const messageContextResponseSchema = z
  .object({
    anchorMessageId: identifierDtoSchema,
    messages: z.array(messageDtoSchema),
    hasEarlier: z.boolean(),
    hasLater: z.boolean(),
  })
  .strict();

export const messageReactionStateResponseSchema = z
  .object({ reactionState: messageReactionStateDtoSchema })
  .strict();

export const messageReactionUsersDtoSchema = z
  .object({
    messageId: identifierDtoSchema,
    emoji: z.string().min(1),
    total: z.number().int().nonnegative(),
    users: z.array(publicUserSummaryDtoSchema),
    nextCursor: identifierDtoSchema.nullable(),
  })
  .strict();

export const messageReactionUsersResponseSchema = messageReactionUsersDtoSchema;

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
export type MessageCoreDto = z.infer<typeof messageCoreDtoSchema>;
export type MessageDto = z.infer<typeof messageDtoSchema>;
export type MessageResponse = z.infer<typeof messageResponseSchema>;
export type MessageListResponse = z.infer<typeof messageListResponseSchema>;
export type MessageContextResponse = z.infer<
  typeof messageContextResponseSchema
>;
export type ReadReceiptDto = z.infer<typeof readReceiptDtoSchema>;
export type ReadReceiptResponse = z.infer<typeof readReceiptResponseSchema>;
export type MessageReactionSummaryDto = z.infer<
  typeof messageReactionSummaryDtoSchema
>;
export type MessageReactionStateDto = z.infer<
  typeof messageReactionStateDtoSchema
>;
export type MessageReactionStateResponse = z.infer<
  typeof messageReactionStateResponseSchema
>;
export type MessageReactionUsersDto = z.infer<
  typeof messageReactionUsersDtoSchema
>;
export type MessageReactionUsersResponse = z.infer<
  typeof messageReactionUsersResponseSchema
>;
export type MessageReadReceiptSummaryDto = z.infer<
  typeof messageReadReceiptSummaryDtoSchema
>;
export type MessageReadReceiptSummaryResponse = z.infer<
  typeof messageReadReceiptSummaryResponseSchema
>;
