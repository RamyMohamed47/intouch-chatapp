import { z } from "zod";

import { dateTimeDtoSchema, identifierDtoSchema } from "../common/index.js";
import {
  ConversationType,
  ConversationVisibility,
} from "../conversations/index.js";
import {
  memberUserDtoSchema,
  membershipRoleSchema,
} from "../memberships/index.js";
import { publicUserSummaryDtoSchema } from "../users/index.js";
import { SearchType } from "./search.schema.js";

export const searchHighlightSegmentDtoSchema = z
  .object({ text: z.string(), matched: z.boolean() })
  .strict();

const searchConversationContextDtoSchema = z.discriminatedUnion("type", [
  z
    .object({
      id: identifierDtoSchema,
      type: z.literal(ConversationType.CHANNEL),
      label: z.string(),
    })
    .strict(),
  z
    .object({
      id: identifierDtoSchema,
      type: z.literal(ConversationType.DIRECT),
      label: z.string(),
    })
    .strict(),
]);

export const messageSearchResultDtoSchema = z
  .object({
    kind: z.literal("MESSAGE"),
    id: identifierDtoSchema,
    conversation: searchConversationContextDtoSchema,
    sender: publicUserSummaryDtoSchema,
    snippet: z.array(searchHighlightSegmentDtoSchema).min(1),
    createdAt: dateTimeDtoSchema,
  })
  .strict();

export const channelSearchResultDtoSchema = z
  .object({
    kind: z.literal("CHANNEL"),
    id: identifierDtoSchema,
    categoryId: identifierDtoSchema,
    name: z.string(),
    visibility: z.enum(ConversationVisibility),
  })
  .strict();

export const personSearchResultDtoSchema = z
  .object({
    kind: z.literal("PERSON"),
    membershipId: identifierDtoSchema,
    role: membershipRoleSchema,
    user: memberUserDtoSchema,
    directConversationId: identifierDtoSchema.nullable(),
  })
  .strict();

export const organizationSearchResultDtoSchema = z.discriminatedUnion("kind", [
  messageSearchResultDtoSchema,
  channelSearchResultDtoSchema,
  personSearchResultDtoSchema,
]);

export const organizationSearchResponseSchema = z
  .object({
    query: z.string(),
    type: z.enum(SearchType),
    results: z.array(organizationSearchResultDtoSchema),
    nextCursor: z.string().nullable(),
  })
  .strict();

export type SearchHighlightSegmentDto = z.infer<
  typeof searchHighlightSegmentDtoSchema
>;
export type MessageSearchResultDto = z.infer<
  typeof messageSearchResultDtoSchema
>;
export type ChannelSearchResultDto = z.infer<
  typeof channelSearchResultDtoSchema
>;
export type PersonSearchResultDto = z.infer<typeof personSearchResultDtoSchema>;
export type OrganizationSearchResultDto = z.infer<
  typeof organizationSearchResultDtoSchema
>;
export type OrganizationSearchResponse = z.infer<
  typeof organizationSearchResponseSchema
>;
