import { z } from "zod";

export const socketIdentifierSchema = z
  .string()
  .regex(/^[a-f\d]{24}$/i, "Must be a valid MongoDB ID");

export const conversationSocketSchema = z
  .object({ conversationId: socketIdentifierSchema })
  .strict();

export const organizationSocketSchema = z
  .object({ organizationId: socketIdentifierSchema })
  .strict();

export type ConversationSocketInput = z.infer<typeof conversationSocketSchema>;
export type OrganizationSocketInput = z.infer<typeof organizationSocketSchema>;
