import {
  chatWallpaperResponseSchema,
  type UpdateChatWallpaperInput,
} from "@intouch/shared/chat-wallpapers";

import { apiRequest, noContentSchema } from "@/lib/api/client";

export const chatWallpapersApi = {
  async getDefault() {
    return (
      await apiRequest(
        "/api/v1/users/me/chat-wallpaper",
        chatWallpaperResponseSchema,
      )
    ).wallpaper;
  },
  async setDefault(input: UpdateChatWallpaperInput) {
    return (
      await apiRequest(
        "/api/v1/users/me/chat-wallpaper",
        chatWallpaperResponseSchema,
        { method: "PUT", body: JSON.stringify(input) },
      )
    ).wallpaper;
  },
  async getForConversation(conversationId: string) {
    return (
      await apiRequest(
        `/api/v1/conversations/${conversationId}/chat-wallpaper`,
        chatWallpaperResponseSchema,
      )
    ).wallpaper;
  },
  async setForConversation(
    conversationId: string,
    input: UpdateChatWallpaperInput,
  ) {
    return (
      await apiRequest(
        `/api/v1/conversations/${conversationId}/chat-wallpaper`,
        chatWallpaperResponseSchema,
        { method: "PUT", body: JSON.stringify(input) },
      )
    ).wallpaper;
  },
  resetConversation(conversationId: string) {
    return apiRequest(
      `/api/v1/conversations/${conversationId}/chat-wallpaper`,
      noContentSchema,
      { method: "DELETE" },
    );
  },
};
