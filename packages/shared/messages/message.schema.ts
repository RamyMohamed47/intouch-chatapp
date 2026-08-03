import { z } from "zod";

const messageContentSchema = z
  .string()
  .min(1)
  .max(4_000)
  .refine((content) => /\S/.test(content), {
    message: "Content must contain non-whitespace text",
  });

export const createMessageSchema = z
  .object({
    content: messageContentSchema,
  })
  .strict();

export const updateMessageSchema = z
  .object({
    content: messageContentSchema,
  })
  .strict();

export const messageHistoryQuerySchema = z
  .object({
    before: z
      .string()
      .regex(/^[a-f\d]{24}$/i, "Before cursor must be a valid MongoDB ID")
      .optional(),
    limit: z.coerce.number().int().min(1).max(100).default(50),
  })
  .strict();

export const updateReadReceiptSchema = z
  .object({
    messageId: z
      .string()
      .regex(/^[a-f\d]{24}$/i, "Message ID must be a valid MongoDB ID"),
  })
  .strict();

export type CreateMessageInput = z.infer<typeof createMessageSchema>;
export type UpdateMessageInput = z.infer<typeof updateMessageSchema>;
export type MessageHistoryQuery = z.infer<typeof messageHistoryQuerySchema>;
export type UpdateReadReceiptInput = z.infer<typeof updateReadReceiptSchema>;
