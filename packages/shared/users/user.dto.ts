import { z } from "zod";

import { dateTimeDtoSchema, identifierDtoSchema } from "../common/index.js";

export const publicUserSummaryDtoSchema = z.object({
  id: identifierDtoSchema,
  username: z.string(),
  displayName: z.string(),
  avatarUrl: z.string().url().optional(),
});

export const publicUserDtoSchema = publicUserSummaryDtoSchema.extend({
  email: z.string().email(),
  createdAt: dateTimeDtoSchema,
  updatedAt: dateTimeDtoSchema,
});

export const userResponseSchema = z.object({
  user: publicUserDtoSchema,
});

export type PublicUserSummaryDto = z.infer<typeof publicUserSummaryDtoSchema>;
export type PublicUserDto = z.infer<typeof publicUserDtoSchema>;
export type UserResponse = z.infer<typeof userResponseSchema>;
