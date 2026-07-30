import { z } from "zod";

export const inviteMemberSchema = z
  .object({
    email: z
      .string()
      .trim()
      .toLowerCase()
      .email("A valid email address is required"),
  })
  .strict();

export type InviteMemberInput = z.infer<typeof inviteMemberSchema>;
