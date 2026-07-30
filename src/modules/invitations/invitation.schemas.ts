import { inviteMemberSchema } from "@intouch/shared/memberships";
import { z } from "zod";

export { inviteMemberSchema };

export const invitationIdParamsSchema = z
  .object({
    id: z
      .string()
      .regex(/^[a-f\d]{24}$/i, "Invitation ID must be a valid MongoDB ID"),
  })
  .strict();

export type InvitationIdParams = z.infer<typeof invitationIdParamsSchema>;
