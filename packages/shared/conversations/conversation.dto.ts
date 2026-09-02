import { z } from "zod";

import { dateTimeDtoSchema, identifierDtoSchema } from "../common/index.js";
import {
  messageCoreDtoSchema,
  readReceiptDtoSchema,
} from "../messages/index.js";
import { publicUserSummaryDtoSchema } from "../users/index.js";
import { voiceOccupancyDtoSchema } from "../voice/index.js";
import {
  ChannelKind,
  ConversationType,
  ConversationVisibility,
} from "./conversation.schema.js";

const conversationSummaryShape = {
  lastMessage: messageCoreDtoSchema.nullable(),
  unreadCount: z.number().int().nonnegative(),
  readReceipt: readReceiptDtoSchema.nullable(),
};

const channelConversationBase = {
  id: identifierDtoSchema,
  organizationId: identifierDtoSchema,
  categoryId: identifierDtoSchema,
  name: z.string(),
  type: z.literal(ConversationType.CHANNEL),
  visibility: z.enum(ConversationVisibility),
  position: z.number().int().nonnegative(),
  createdAt: dateTimeDtoSchema,
  updatedAt: dateTimeDtoSchema,
};

export const textChannelConversationDtoSchema = z.object({
  ...channelConversationBase,
  kind: z.literal(ChannelKind.TEXT),
  lastMessage: conversationSummaryShape.lastMessage.optional(),
  unreadCount: conversationSummaryShape.unreadCount.optional(),
  readReceipt: conversationSummaryShape.readReceipt.optional(),
});

export const voiceChannelConversationDtoSchema = z.object({
  ...channelConversationBase,
  kind: z.literal(ChannelKind.VOICE),
  occupancy: voiceOccupancyDtoSchema,
});

export const channelConversationDtoSchema = z.union([
  textChannelConversationDtoSchema,
  voiceChannelConversationDtoSchema,
]);

export const directConversationDtoSchema = z.object({
  id: identifierDtoSchema,
  organizationId: identifierDtoSchema,
  type: z.literal(ConversationType.DIRECT),
  peer: publicUserSummaryDtoSchema,
  ...conversationSummaryShape,
  peerReadReceipt: readReceiptDtoSchema.nullable(),
  createdAt: dateTimeDtoSchema,
  updatedAt: dateTimeDtoSchema,
});

export const conversationDtoSchema = z.union([
  textChannelConversationDtoSchema,
  voiceChannelConversationDtoSchema,
  directConversationDtoSchema,
]);

export const conversationResponseSchema = z.object({
  conversation: conversationDtoSchema,
});

export const conversationListResponseSchema = z.object({
  conversations: z.array(conversationDtoSchema),
});

export const directMessageResponseSchema = z.object({
  directMessage: directConversationDtoSchema,
});

export const directMessageListResponseSchema = z.object({
  directMessages: z.array(directConversationDtoSchema),
  nextCursor: z.string().nullable(),
});

export const conversationParticipantDtoSchema = z.object({
  id: identifierDtoSchema,
  organizationId: identifierDtoSchema,
  conversationId: identifierDtoSchema,
  userId: identifierDtoSchema,
  addedByUserId: identifierDtoSchema,
  joinedAt: dateTimeDtoSchema,
});

export const conversationParticipantViewDtoSchema =
  conversationParticipantDtoSchema.extend({
    user: publicUserSummaryDtoSchema,
  });

export const participantResponseSchema = z.object({
  participant: conversationParticipantDtoSchema,
});

export const participantListResponseSchema = z.object({
  participants: z.array(conversationParticipantViewDtoSchema),
});

export type ChannelConversationDto = z.infer<
  typeof channelConversationDtoSchema
>;
export type TextChannelConversationDto = z.infer<
  typeof textChannelConversationDtoSchema
>;
export type VoiceChannelConversationDto = z.infer<
  typeof voiceChannelConversationDtoSchema
>;
export type DirectConversationDto = z.infer<typeof directConversationDtoSchema>;
export type ConversationDto = z.infer<typeof conversationDtoSchema>;
export type ConversationResponse = z.infer<typeof conversationResponseSchema>;
export type ConversationListResponse = z.infer<
  typeof conversationListResponseSchema
>;
export type DirectMessageResponse = z.infer<typeof directMessageResponseSchema>;
export type DirectMessageListResponse = z.infer<
  typeof directMessageListResponseSchema
>;
export type ConversationParticipantDto = z.infer<
  typeof conversationParticipantDtoSchema
>;
export type ConversationParticipantViewDto = z.infer<
  typeof conversationParticipantViewDtoSchema
>;
export type ParticipantResponse = z.infer<typeof participantResponseSchema>;
export type ParticipantListResponse = z.infer<
  typeof participantListResponseSchema
>;
