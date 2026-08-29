import type { ClientSession, Types } from "mongoose";

import ChatWallpaperPreferenceModel, {
  type ChatWallpaperPreferenceDocument,
} from "./chat-wallpaper.model.js";
import type {
  ChatWallpaperPreferenceRecord,
  UpsertChatWallpaperPreferenceInput,
} from "./chat-wallpaper.types.js";

type LeanPreference = ChatWallpaperPreferenceDocument & {
  _id: Types.ObjectId;
};

const toRecord = (
  preference: LeanPreference,
): ChatWallpaperPreferenceRecord => ({
  id: preference._id.toString(),
  userId: preference.userId.toString(),
  conversationId: preference.conversationId?.toString() ?? null,
  wallpaperId: preference.wallpaperId,
  dimming: preference.dimming,
  createdAt: preference.createdAt,
  updatedAt: preference.updatedAt,
});

export interface ChatWallpaperRepository {
  findDefault(userId: string): Promise<ChatWallpaperPreferenceRecord | null>;
  findForConversation(
    userId: string,
    conversationId: string,
  ): Promise<ChatWallpaperPreferenceRecord | null>;
  upsert(
    input: UpsertChatWallpaperPreferenceInput,
  ): Promise<ChatWallpaperPreferenceRecord>;
  deleteForConversation(
    userId: string,
    conversationId: string,
  ): Promise<boolean>;
  deleteByConversationId(conversationId: string): Promise<number>;
  deleteByConversationIds(conversationIds: readonly string[]): Promise<number>;
}

const createMongooseChatWallpaperRepository = (
  session?: ClientSession,
): ChatWallpaperRepository => {
  const withSession = <T extends { session(value: ClientSession): T }>(
    query: T,
  ) => (session ? query.session(session) : query);

  return {
    async findDefault(userId) {
      const preference = await withSession(
        ChatWallpaperPreferenceModel.findOne({
          userId,
          conversationId: null,
        }).lean<LeanPreference>(),
      ).exec();
      return preference ? toRecord(preference) : null;
    },

    async findForConversation(userId, conversationId) {
      const preference = await withSession(
        ChatWallpaperPreferenceModel.findOne({
          userId,
          conversationId,
        }).lean<LeanPreference>(),
      ).exec();
      return preference ? toRecord(preference) : null;
    },

    async upsert(input) {
      const preference = await withSession(
        ChatWallpaperPreferenceModel.findOneAndUpdate(
          { userId: input.userId, conversationId: input.conversationId },
          {
            $set: {
              wallpaperId: input.wallpaperId,
              dimming: input.dimming,
            },
          },
          { upsert: true, new: true, runValidators: true },
        ).lean<LeanPreference>(),
      ).exec();
      if (!preference) {
        throw new Error(
          "Chat wallpaper preference upsert returned no document",
        );
      }
      return toRecord(preference);
    },

    async deleteForConversation(userId, conversationId) {
      const result = await withSession(
        ChatWallpaperPreferenceModel.deleteOne({ userId, conversationId }),
      ).exec();
      return result.deletedCount === 1;
    },

    async deleteByConversationId(conversationId) {
      const result = await withSession(
        ChatWallpaperPreferenceModel.deleteMany({ conversationId }),
      ).exec();
      return result.deletedCount;
    },

    async deleteByConversationIds(conversationIds) {
      if (conversationIds.length === 0) return 0;
      const result = await withSession(
        ChatWallpaperPreferenceModel.deleteMany({
          conversationId: { $in: conversationIds },
        }),
      ).exec();
      return result.deletedCount;
    },
  };
};

export default createMongooseChatWallpaperRepository;
