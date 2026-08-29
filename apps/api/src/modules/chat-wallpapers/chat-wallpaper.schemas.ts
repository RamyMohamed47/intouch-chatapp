import { updateChatWallpaperSchema } from "@intouch/shared/chat-wallpapers";
import { z } from "zod";

export const chatWallpaperConversationParamsSchema = z
  .object({
    conversationId: z
      .string()
      .regex(/^[a-f\d]{24}$/i, "Conversation ID must be a valid MongoDB ID"),
  })
  .strict();

export { updateChatWallpaperSchema };
export type ChatWallpaperConversationParams = z.infer<
  typeof chatWallpaperConversationParamsSchema
>;
