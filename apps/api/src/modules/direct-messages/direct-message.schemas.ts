import {
  createDirectMessageSchema,
  listDirectMessagesQuerySchema,
} from "@intouch/shared/conversations";
import { z } from "zod";

const organizationIdSchema = z
  .string()
  .regex(/^[a-f\d]{24}$/i, "Organization ID must be a valid MongoDB ID");

export const directMessageOrganizationParamsSchema = z
  .object({ organizationId: organizationIdSchema })
  .strict();

export { createDirectMessageSchema, listDirectMessagesQuerySchema };

export type DirectMessageOrganizationParams = z.infer<
  typeof directMessageOrganizationParamsSchema
>;
