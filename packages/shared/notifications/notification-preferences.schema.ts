import { z } from "zod";

import { dateTimeDtoSchema, identifierDtoSchema } from "../common/index.js";

export const notificationCategoryPreferencesSchema = z
  .object({
    invitations: z.boolean(),
    directMessages: z.boolean(),
    mentionsAndReplies: z.boolean(),
    reactions: z.boolean(),
  })
  .strict();

export const updateNotificationPreferencesSchema = z
  .object({ categories: notificationCategoryPreferencesSchema })
  .strict();

export const notificationMuteRequestSchema = z
  .object({ mutedUntil: dateTimeDtoSchema.nullable() })
  .strict();

export const notificationMuteDtoSchema = z
  .object({
    organizationId: identifierDtoSchema,
    conversationId: identifierDtoSchema.nullable(),
    mutedUntil: dateTimeDtoSchema.nullable(),
  })
  .strict();

export const notificationPreferencesDtoSchema = z
  .object({
    categories: notificationCategoryPreferencesSchema,
    mutes: z.array(notificationMuteDtoSchema),
  })
  .strict();

export const notificationPreferencesResponseSchema = z
  .object({ preferences: notificationPreferencesDtoSchema })
  .strict();

export type NotificationCategoryPreferences = z.infer<
  typeof notificationCategoryPreferencesSchema
>;
export type UpdateNotificationPreferencesInput = z.infer<
  typeof updateNotificationPreferencesSchema
>;
export type NotificationMuteInput = z.infer<
  typeof notificationMuteRequestSchema
>;
export type NotificationMuteDto = z.infer<typeof notificationMuteDtoSchema>;
export type NotificationPreferencesDto = z.infer<
  typeof notificationPreferencesDtoSchema
>;
