import { z } from "zod";

export const googleOAuthCallbackQuerySchema = z.object({
  state: z.string().min(1).optional(),
  code: z.string().min(1).optional(),
  error: z.string().min(1).optional(),
});

export const googleAuthRedirectQuerySchema = z
  .object({
    googleAuth: z.enum(["success", "failed"]).optional(),
  })
  .strict();

export type GoogleOAuthCallbackQuery = z.infer<
  typeof googleOAuthCallbackQuerySchema
>;
export type GoogleAuthRedirectQuery = z.infer<
  typeof googleAuthRedirectQuerySchema
>;
