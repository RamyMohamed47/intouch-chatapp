import { z } from "zod";

import {
  chatWallpaperIdSchema,
  chatWallpaperSourceSchema,
} from "./chat-wallpaper.schema.js";

export const chatWallpaperDtoSchema = z
  .object({
    wallpaperId: chatWallpaperIdSchema,
    dimming: z.number().int().min(0).max(80),
    source: chatWallpaperSourceSchema,
  })
  .strict();

export const chatWallpaperResponseSchema = z
  .object({ wallpaper: chatWallpaperDtoSchema })
  .strict();

export type ChatWallpaperDto = z.infer<typeof chatWallpaperDtoSchema>;
export type ChatWallpaperResponse = z.infer<typeof chatWallpaperResponseSchema>;
