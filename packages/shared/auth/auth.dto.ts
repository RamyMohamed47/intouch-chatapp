import { z } from "zod";

import { publicUserDtoSchema } from "../users/index.js";

export const authResponseSchema = z.object({
  user: publicUserDtoSchema,
  accessToken: z.string().min(1),
});

export const refreshResponseSchema = z.object({
  accessToken: z.string().min(1),
});

export type AuthResponse = z.infer<typeof authResponseSchema>;
export type RefreshResponse = z.infer<typeof refreshResponseSchema>;
