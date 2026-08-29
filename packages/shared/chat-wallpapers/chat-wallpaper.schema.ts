import { z } from "zod";

export const ChatWallpaperId = {
  NONE: "NONE",
  INTOUCH_DOODLE: "INTOUCH_DOODLE",
  DOODLE_ORBIT: "DOODLE_ORBIT",
  DOODLE_CHAT: "DOODLE_CHAT",
  DOODLE_NIGHT: "DOODLE_NIGHT",
  ABSTRACT_AURORA: "ABSTRACT_AURORA",
  ABSTRACT_SUNSET: "ABSTRACT_SUNSET",
  ABSTRACT_OCEAN: "ABSTRACT_OCEAN",
  ABSTRACT_PAPER: "ABSTRACT_PAPER",
  SCENERY_COAST: "SCENERY_COAST",
  SCENERY_MOUNTAINS: "SCENERY_MOUNTAINS",
  SCENERY_FOREST: "SCENERY_FOREST",
  SCENERY_CITY_LIGHTS: "SCENERY_CITY_LIGHTS",
} as const;

export const ChatWallpaperSource = {
  DEFAULT: "DEFAULT",
  CONVERSATION: "CONVERSATION",
} as const;

export const chatWallpaperIdSchema = z.enum(ChatWallpaperId);
export const chatWallpaperSourceSchema = z.enum(ChatWallpaperSource);

export const updateChatWallpaperSchema = z
  .object({
    wallpaperId: chatWallpaperIdSchema,
    dimming: z.number().int().min(0).max(80),
  })
  .strict()
  .transform((input) =>
    input.wallpaperId === ChatWallpaperId.NONE
      ? { ...input, dimming: 0 }
      : input,
  );

export type ChatWallpaperId = z.infer<typeof chatWallpaperIdSchema>;
export type ChatWallpaperSource = z.infer<typeof chatWallpaperSourceSchema>;
export type UpdateChatWallpaperInput = z.infer<
  typeof updateChatWallpaperSchema
>;
