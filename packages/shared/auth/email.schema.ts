import { z } from "zod";

import { registerSchema } from "./register.schema.js";

const emailSchema = registerSchema.shape.email;
const passwordSchema = registerSchema.shape.password;

export const authActionTokenSchema = z
  .string()
  .trim()
  .min(43, "A valid authentication token is required")
  .max(256, "Authentication token is too long")
  .regex(/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/, "Authentication token is invalid");

export const verifyEmailSchema = z
  .object({ token: authActionTokenSchema })
  .strict();

export const resendVerificationSchema = z
  .object({ email: emailSchema })
  .strict();

export const forgotPasswordSchema = z.object({ email: emailSchema }).strict();

export const resetPasswordSchema = z
  .object({
    token: authActionTokenSchema,
    password: passwordSchema,
  })
  .strict();

export type VerifyEmailInput = z.infer<typeof verifyEmailSchema>;
export type ResendVerificationInput = z.infer<typeof resendVerificationSchema>;
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;
