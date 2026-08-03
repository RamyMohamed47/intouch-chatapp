import { z } from "zod";

export const ConversationType = {
  CHANNEL: "CHANNEL",
  DIRECT: "DIRECT",
} as const;

export const ConversationVisibility = {
  PUBLIC: "PUBLIC",
  PRIVATE: "PRIVATE",
} as const;

export type ConversationTypeValue =
  (typeof ConversationType)[keyof typeof ConversationType];
export type ConversationVisibilityType =
  (typeof ConversationVisibility)[keyof typeof ConversationVisibility];

const mongoIdSchema = z
  .string()
  .regex(/^[a-f\d]{24}$/i, "Must be a valid MongoDB ID");
const conversationNameSchema = z.string().trim().min(1).max(100);

export const createConversationSchema = z
  .object({
    categoryId: mongoIdSchema,
    name: conversationNameSchema,
    visibility: z
      .enum(ConversationVisibility)
      .default(ConversationVisibility.PUBLIC),
  })
  .strict();

export const updateConversationSchema = z
  .object({
    categoryId: mongoIdSchema.optional(),
    name: conversationNameSchema.optional(),
    visibility: z.enum(ConversationVisibility).optional(),
    position: z.number().int().nonnegative().optional(),
  })
  .strict()
  .refine((input) => Object.keys(input).length > 0, {
    message: "At least one field is required",
  });

export const addConversationParticipantSchema = z
  .object({
    userId: mongoIdSchema,
  })
  .strict();

export const listConversationsQuerySchema = z
  .object({
    categoryId: mongoIdSchema.optional(),
  })
  .strict();

export const createDirectMessageSchema = z
  .object({
    recipientUserId: mongoIdSchema,
  })
  .strict();

export const listDirectMessagesQuerySchema = z
  .object({
    before: z.string().trim().min(1).max(512).optional(),
    limit: z.coerce.number().int().min(1).max(100).default(30),
  })
  .strict();

export type CreateConversationInput = z.infer<typeof createConversationSchema>;
export type UpdateConversationInput = z.infer<typeof updateConversationSchema>;
export type AddConversationParticipantInput = z.infer<
  typeof addConversationParticipantSchema
>;
export type ListConversationsQuery = z.infer<
  typeof listConversationsQuerySchema
>;
export type CreateDirectMessageInput = z.infer<
  typeof createDirectMessageSchema
>;
export type ListDirectMessagesQuery = z.infer<
  typeof listDirectMessagesQuerySchema
>;
