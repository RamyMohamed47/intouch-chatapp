import type {
  ChatWallpaperIdType,
  UpdateChatWallpaperInput,
} from "@intouch/shared/chat-wallpapers";

export interface ChatWallpaperPreferenceRecord {
  id: string;
  userId: string;
  conversationId: string | null;
  wallpaperId: ChatWallpaperIdType;
  dimming: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface UpsertChatWallpaperPreferenceInput extends UpdateChatWallpaperInput {
  userId: string;
  conversationId: string | null;
}
