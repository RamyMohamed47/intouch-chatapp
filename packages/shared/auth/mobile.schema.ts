import { z } from "zod";

import { loginSchema } from "./login.schema.js";

export const mobileLoginSchema = loginSchema;

export const mobileGoogleSchema = z
  .object({ idToken: z.string().trim().min(1).max(16_384) })
  .strict();

export const mobileRefreshSchema = z
  .object({ refreshToken: z.string().trim().min(1).max(1_024) })
  .strict();

export const mobileLogoutSchema = mobileRefreshSchema.extend({
  installationId: z.uuid().optional(),
});

export type MobileLoginInput = z.infer<typeof mobileLoginSchema>;
export type MobileGoogleInput = z.infer<typeof mobileGoogleSchema>;
export type MobileRefreshInput = z.infer<typeof mobileRefreshSchema>;
export type MobileLogoutInput = z.infer<typeof mobileLogoutSchema>;
