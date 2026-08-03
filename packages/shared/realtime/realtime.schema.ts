import { z } from "zod";

const mongoIdSchema = z
  .string()
  .regex(/^[a-f\d]{24}$/i, "Must be a valid MongoDB ID");

export const conversationSocketSchema = z
  .object({ conversationId: mongoIdSchema })
  .strict();

export const organizationSocketSchema = z
  .object({ organizationId: mongoIdSchema })
  .strict();

export type ConversationSocketInput = z.infer<typeof conversationSocketSchema>;
export type OrganizationSocketInput = z.infer<typeof organizationSocketSchema>;
