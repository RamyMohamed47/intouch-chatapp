import { z } from "zod";

const mongoIdSchema = z
  .string()
  .regex(/^[a-f\d]{24}$/i, "Must be a valid MongoDB ID");

export const SearchType = {
  ALL: "ALL",
  MESSAGES: "MESSAGES",
  CHANNELS: "CHANNELS",
  PEOPLE: "PEOPLE",
} as const;

export const searchTypeSchema = z.enum(SearchType);

export const organizationSearchQuerySchema = z
  .object({
    q: z.string().trim().min(2).max(100),
    type: searchTypeSchema.default(SearchType.ALL),
    conversationId: mongoIdSchema.optional(),
    cursor: z.string().min(1).max(4_096).optional(),
    limit: z.coerce.number().int().min(1).max(50).default(20),
  })
  .strict()
  .superRefine((query, context) => {
    if (query.conversationId && query.type !== SearchType.MESSAGES) {
      context.addIssue({
        code: "custom",
        path: ["conversationId"],
        message: "Conversation filtering is only available for message search",
      });
    }
    if (query.cursor && query.type === SearchType.ALL) {
      context.addIssue({
        code: "custom",
        path: ["cursor"],
        message: "Pagination requires a specific search type",
      });
    }
  });

export type SearchTypeValue = z.infer<typeof searchTypeSchema>;
export type OrganizationSearchQuery = z.infer<
  typeof organizationSearchQuerySchema
>;
