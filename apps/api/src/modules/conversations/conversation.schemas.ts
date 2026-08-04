import {
  addConversationParticipantSchema,
  createConversationSchema,
  listConversationsQuerySchema,
  updateConversationSchema,
} from "@intouch/shared/conversations";
import { z } from "zod";

const mongoId = (label: string) =>
  z.string().regex(/^[a-f\d]{24}$/i, `${label} must be a valid MongoDB ID`);

export {
  addConversationParticipantSchema,
  createConversationSchema,
  listConversationsQuerySchema,
  updateConversationSchema,
};

export const organizationConversationsParamsSchema = z
  .object({ organizationId: mongoId("Organization ID") })
  .strict();
export const conversationParamsSchema = z
  .object({ conversationId: mongoId("Conversation ID") })
  .strict();
export const conversationParticipantParamsSchema = z
  .object({
    conversationId: mongoId("Conversation ID"),
    userId: mongoId("User ID"),
  })
  .strict();

export type OrganizationConversationsParams = z.infer<
  typeof organizationConversationsParamsSchema
>;
export type ConversationParams = z.infer<typeof conversationParamsSchema>;
export type ConversationParticipantParams = z.infer<
  typeof conversationParticipantParamsSchema
>;
