import { Schema, model, type Types } from "mongoose";

import { ChatWallpaperId } from "@intouch/shared/chat-wallpapers";

interface ChatWallpaperPreferenceDocument {
  userId: Types.ObjectId;
  conversationId: Types.ObjectId | null;
  wallpaperId: (typeof ChatWallpaperId)[keyof typeof ChatWallpaperId];
  dimming: number;
  createdAt: Date;
  updatedAt: Date;
}

const chatWallpaperPreferenceSchema =
  new Schema<ChatWallpaperPreferenceDocument>(
    {
      userId: { type: Schema.Types.ObjectId, required: true, ref: "User" },
      conversationId: {
        type: Schema.Types.ObjectId,
        ref: "Conversation",
        default: null,
      },
      wallpaperId: {
        type: String,
        enum: Object.values(ChatWallpaperId),
        required: true,
      },
      dimming: { type: Number, required: true, min: 0, max: 80 },
    },
    { timestamps: true },
  );

chatWallpaperPreferenceSchema.index(
  { userId: 1, conversationId: 1 },
  { unique: true, name: "unique_user_chat_wallpaper_preference" },
);
chatWallpaperPreferenceSchema.index(
  { conversationId: 1 },
  {
    name: "chat_wallpapers_by_conversation",
    partialFilterExpression: { conversationId: { $type: "objectId" } },
  },
);

const ChatWallpaperPreferenceModel = model<ChatWallpaperPreferenceDocument>(
  "ChatWallpaperPreference",
  chatWallpaperPreferenceSchema,
);

export type { ChatWallpaperPreferenceDocument };
export default ChatWallpaperPreferenceModel;
