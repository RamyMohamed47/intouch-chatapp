import { z } from "zod";
import emojiRegex from "emoji-regex";

const mongoIdSchema = z
  .string()
  .regex(/^[a-f\d]{24}$/i, "Must be a valid MongoDB ID");

const isSingleEmoji = (value: string) => {
  const matches = [...value.matchAll(emojiRegex())];
  return matches.length === 1 && matches[0]?.[0] === value;
};

export const reactionEmojiSchema = z
  .string()
  .min(1)
  .max(32)
  .transform((value) => value.normalize("NFC"))
  .refine(isSingleEmoji, "Reaction must be exactly one emoji");

export const messageContentSchema = z
  .string()
  .min(1)
  .max(4_000)
  .refine((content) => /\S/.test(content), {
    message: "Content must contain non-whitespace text",
  });

export const createMessageSchema = z
  .object({
    content: messageContentSchema.optional(),
    uploadIds: z.array(mongoIdSchema).max(5).optional(),
  })
  .strict()
  .refine(
    ({ content, uploadIds }) =>
      content !== undefined || (uploadIds?.length ?? 0) > 0,
    { message: "A message requires content or an attachment" },
  )
  .refine(
    ({ uploadIds }) =>
      uploadIds === undefined || new Set(uploadIds).size === uploadIds.length,
    {
      message: "Upload IDs must be unique",
    },
  );

export const updateMessageSchema = z
  .object({
    content: messageContentSchema.nullable(),
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

export const setMessageReactionSchema = z
  .object({ emoji: reactionEmojiSchema })
  .strict();

export const messageReactionUsersQuerySchema = z
  .object({
    emoji: reactionEmojiSchema,
    before: mongoIdSchema.optional(),
    limit: z.coerce.number().int().min(1).max(100).default(30),
  })
  .strict();

export type CreateMessageInput = z.infer<typeof createMessageSchema>;
export type UpdateMessageInput = z.infer<typeof updateMessageSchema>;
export type MessageHistoryQuery = z.infer<typeof messageHistoryQuerySchema>;
export type UpdateReadReceiptInput = z.infer<typeof updateReadReceiptSchema>;
export type SetMessageReactionInput = z.infer<typeof setMessageReactionSchema>;
export type MessageReactionUsersQuery = z.infer<
  typeof messageReactionUsersQuerySchema
>;
