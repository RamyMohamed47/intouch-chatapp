import {
  chatWallpaperResponseSchema,
  type UpdateChatWallpaperInput,
} from "@intouch/shared/chat-wallpapers";

import { apiRequest, noContentSchema } from "@/core/api/client";

export const wallpaperApi = {
  getDefault: async () =>
    (
      await apiRequest(
        "/api/v1/users/me/chat-wallpaper",
        chatWallpaperResponseSchema,
      )
    ).wallpaper,
  setDefault: async (input: UpdateChatWallpaperInput) =>
    (
      await apiRequest(
        "/api/v1/users/me/chat-wallpaper",
        chatWallpaperResponseSchema,
        { method: "PUT", body: JSON.stringify(input) },
      )
    ).wallpaper,
  get: async (conversationId: string) =>
    (
      await apiRequest(
        `/api/v1/conversations/${conversationId}/chat-wallpaper`,
        chatWallpaperResponseSchema,
      )
    ).wallpaper,
  set: async (conversationId: string, input: UpdateChatWallpaperInput) =>
    (
      await apiRequest(
        `/api/v1/conversations/${conversationId}/chat-wallpaper`,
        chatWallpaperResponseSchema,
        { method: "PUT", body: JSON.stringify(input) },
      )
    ).wallpaper,
  reset: (conversationId: string) =>
    apiRequest(
      `/api/v1/conversations/${conversationId}/chat-wallpaper`,
      noContentSchema,
      { method: "DELETE" },
    ),
};
