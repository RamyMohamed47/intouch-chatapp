import {
  assetAccessResponseSchema,
  completeUploadResponseSchema,
  createUploadResponseSchema,
  type AssetParams,
  type CreateUploadInput,
  type UploadParams,
  type UpdateAvatarInput,
} from "@intouch/shared/uploads";
import { userResponseSchema } from "@intouch/shared/users";
import type { RequestHandler } from "express";

import UnauthorizedError from "../../errors/UnauthorizedError.js";
import catchAsync from "../../utils/catchAsync.js";
import type { AuthLocals } from "../auth/auth.types.js";
import type { UploadService } from "./upload.service.js";

const userIdFrom = (locals: AuthLocals) => {
  if (!locals.userId) throw new UnauthorizedError();
  return locals.userId;
};

export interface UploadController {
  create: RequestHandler;
  complete: RequestHandler;
  cancel: RequestHandler;
  access: RequestHandler;
  setAvatar: RequestHandler;
  removeAvatar: RequestHandler;
}

export const createUploadController = (
  service: UploadService,
): UploadController => ({
  create: catchAsync(async (req, res) => {
    const result = await service.create(
      userIdFrom(res.locals as AuthLocals),
      req.body as CreateUploadInput,
    );
    res.status(201).json(createUploadResponseSchema.parse(result));
  }),

  complete: catchAsync(async (req, res) => {
    const { uploadId } = req.params as unknown as UploadParams;
    const upload = await service.complete(
      userIdFrom(res.locals as AuthLocals),
      uploadId,
    );
    res.status(200).json(completeUploadResponseSchema.parse({ upload }));
  }),

  cancel: catchAsync(async (req, res) => {
    const { uploadId } = req.params as unknown as UploadParams;
    await service.cancel(userIdFrom(res.locals as AuthLocals), uploadId);
    res.status(204).send();
  }),

  access: catchAsync(async (req, res) => {
    const { assetId } = req.params as unknown as AssetParams;
    const access = await service.access(
      userIdFrom(res.locals as AuthLocals),
      assetId,
    );
    res.status(200).json(assetAccessResponseSchema.parse(access));
  }),

  setAvatar: catchAsync(async (req, res) => {
    const { uploadId } = req.body as UpdateAvatarInput;
    const user = await service.setAvatar(
      userIdFrom(res.locals as AuthLocals),
      uploadId,
    );
    res.status(200).json(userResponseSchema.parse({ user }));
  }),

  removeAvatar: catchAsync(async (_req, res) => {
    const user = await service.removeAvatar(
      userIdFrom(res.locals as AuthLocals),
    );
    res.status(200).json(userResponseSchema.parse({ user }));
  }),
});
