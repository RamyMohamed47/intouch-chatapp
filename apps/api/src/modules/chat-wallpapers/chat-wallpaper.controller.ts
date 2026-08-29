import {
  chatWallpaperResponseSchema,
  type UpdateChatWallpaperInput,
} from "@intouch/shared/chat-wallpapers";
import type { RequestHandler } from "express";

import UnauthorizedError from "../../errors/UnauthorizedError.js";
import catchAsync from "../../utils/catchAsync.js";
import type { AuthLocals } from "../auth/auth.types.js";
import type { ChatWallpaperConversationParams } from "./chat-wallpaper.schemas.js";
import type { ChatWallpaperService } from "./chat-wallpaper.service.js";

const getUserId = (locals: AuthLocals) => {
  if (!locals.userId) throw new UnauthorizedError();
  return locals.userId;
};

export interface ChatWallpaperController {
  getDefault: RequestHandler;
  setDefault: RequestHandler;
  getForConversation: RequestHandler;
  setForConversation: RequestHandler;
  resetConversation: RequestHandler;
}

const createChatWallpaperController = (
  service: ChatWallpaperService,
): ChatWallpaperController => ({
  getDefault: catchAsync(async (_req, res) => {
    const wallpaper = await service.getDefault(
      getUserId(res.locals as AuthLocals),
    );
    res.status(200).json(chatWallpaperResponseSchema.parse({ wallpaper }));
  }),
  setDefault: catchAsync(async (req, res) => {
    const wallpaper = await service.setDefault(
      getUserId(res.locals as AuthLocals),
      req.body as UpdateChatWallpaperInput,
    );
    res.status(200).json(chatWallpaperResponseSchema.parse({ wallpaper }));
  }),
  getForConversation: catchAsync(async (req, res) => {
    const { conversationId } =
      req.params as unknown as ChatWallpaperConversationParams;
    const wallpaper = await service.getForConversation(
      getUserId(res.locals as AuthLocals),
      conversationId,
    );
    res.status(200).json(chatWallpaperResponseSchema.parse({ wallpaper }));
  }),
  setForConversation: catchAsync(async (req, res) => {
    const { conversationId } =
      req.params as unknown as ChatWallpaperConversationParams;
    const wallpaper = await service.setForConversation(
      getUserId(res.locals as AuthLocals),
      conversationId,
      req.body as UpdateChatWallpaperInput,
    );
    res.status(200).json(chatWallpaperResponseSchema.parse({ wallpaper }));
  }),
  resetConversation: catchAsync(async (req, res) => {
    const { conversationId } =
      req.params as unknown as ChatWallpaperConversationParams;
    await service.resetConversation(
      getUserId(res.locals as AuthLocals),
      conversationId,
    );
    res.status(204).send();
  }),
});

export default createChatWallpaperController;
