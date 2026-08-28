import { z } from "zod";

import { publicUserDtoSchema } from "../users/index.js";

export const authResponseSchema = z.object({
  user: publicUserDtoSchema,
  accessToken: z.string().min(1),
});

export const refreshResponseSchema = z.object({
  accessToken: z.string().min(1),
});

export const registrationPendingResponseSchema = z.object({
  email: z.string().email(),
  verificationRequired: z.literal(true),
});

export const authRequestAcceptedResponseSchema = z.object({
  accepted: z.literal(true),
});

export type AuthResponse = z.infer<typeof authResponseSchema>;
export type RefreshResponse = z.infer<typeof refreshResponseSchema>;
export type RegistrationPendingResponse = z.infer<
  typeof registrationPendingResponseSchema
>;
export type AuthRequestAcceptedResponse = z.infer<
  typeof authRequestAcceptedResponseSchema
>;
