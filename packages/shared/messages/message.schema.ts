import { z } from "zod";
import emojiRegex from "emoji-regex";

const mongoIdSchema = z
  .string()
  .regex(/^[a-f\d]{24}$/i, "Must be a valid MongoDB ID");

export const messageMentionSchema = z
  .object({
    userId: mongoIdSchema,
    start: z.number().int().nonnegative(),
    end: z.number().int().positive(),
  })
  .strict()
  .refine(({ start, end }) => end > start, {
    message: "Mention end must be after its start",
  });

const validateMentions = (
  value: {
    content: string | null | undefined;
    mentions: Array<{ start: number; end: number }>;
  },
  context: z.RefinementCtx,
) => {
  const mentions = value.mentions ?? [];
  if (mentions.length === 0) return;
  if (!value.content) {
    context.addIssue({
      code: "custom",
      path: ["mentions"],
      message: "Mentions require message content",
    });
    return;
  }
  let previousEnd = -1;
  for (const [index, mention] of mentions.entries()) {
    if (mention.end > value.content.length) {
      context.addIssue({
        code: "custom",
        path: ["mentions", index, "end"],
        message: "Mention range exceeds message content",
      });
    }
    if (mention.start < previousEnd) {
      context.addIssue({
        code: "custom",
        path: ["mentions", index],
        message: "Mention ranges must not overlap and must be ordered",
      });
    }
    previousEnd = mention.end;
  }
};

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
    replyToMessageId: mongoIdSchema.optional(),
    mentions: z.array(messageMentionSchema).max(25).optional(),
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
  )
  .superRefine((value, context) =>
    validateMentions(
      { content: value.content, mentions: value.mentions ?? [] },
      context,
    ),
  );

export const updateMessageSchema = z
  .object({
    content: messageContentSchema.nullable(),
    mentions: z.array(messageMentionSchema).max(25).optional(),
  })
  .strict()
  .superRefine((value, context) =>
    validateMentions(
      { content: value.content, mentions: value.mentions ?? [] },
      context,
    ),
  );

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
