import express, { type RequestHandler } from "express";
import {
  MAX_UPLOAD_FILE_BYTES,
  MAX_SQUARE_IMAGE_UPLOAD_BYTES,
  UploadPurpose,
  assetParamsSchema,
  createUploadSchema,
  uploadParamsSchema,
  updateAvatarSchema,
} from "@intouch/shared/uploads";

import {
  validateBody,
  validateParams,
} from "../../middleware/validateRequest.js";
import type { UploadController } from "./upload.controller.js";
import { UploadValidationError } from "./upload.errors.js";

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

const rejectOversizedUploads: RequestHandler = (req, _res, next) => {
  const body: unknown = req.body;
  const files = isRecord(body) ? body.files : undefined;
  const purpose = isRecord(body) ? body.purpose : undefined;
  const maximumBytes =
    purpose === UploadPurpose.AVATAR ||
    purpose === UploadPurpose.ORGANIZATION_LOGO
      ? MAX_SQUARE_IMAGE_UPLOAD_BYTES
      : MAX_UPLOAD_FILE_BYTES;
  const oversized =
    Array.isArray(files) &&
    files.some(
      (file) =>
        isRecord(file) &&
        typeof file.size === "number" &&
        file.size > maximumBytes,
    );
  next(
    oversized
      ? new UploadValidationError(
          maximumBytes === MAX_SQUARE_IMAGE_UPLOAD_BYTES
            ? "Image must not exceed 5 MB"
            : "File must not exceed 25 MB",
          413,
        )
      : undefined,
  );
};

export const createUploadRouter = (
  controller: UploadController,
  requireAccessToken: RequestHandler,
  mutateLimit: RequestHandler,
) => {
  const router = express.Router();
  router.use(requireAccessToken);
  router.post(
    "/",
    mutateLimit,
    rejectOversizedUploads,
    validateBody(createUploadSchema),
    controller.create,
  );
  router
    .route("/:uploadId")
    .delete(mutateLimit, validateParams(uploadParamsSchema), controller.cancel);
  router.post(
    "/:uploadId/complete",
    mutateLimit,
    validateParams(uploadParamsSchema),
    controller.complete,
  );
  return router;
};

export const createAssetRouter = (
  controller: UploadController,
  requireAccessToken: RequestHandler,
  accessLimit: RequestHandler,
) => {
  const router = express.Router();
  router.use(requireAccessToken);
  router.get(
    "/:assetId/access",
    accessLimit,
    validateParams(assetParamsSchema),
    controller.access,
  );
  return router;
};

export const createUserAvatarRouter = (
  controller: UploadController,
  requireAccessToken: RequestHandler,
  mutateLimit: RequestHandler,
) => {
  const router = express.Router();
  router.use(requireAccessToken);
  router
    .route("/me/avatar")
    .put(mutateLimit, validateBody(updateAvatarSchema), controller.setAvatar)
    .delete(mutateLimit, controller.removeAvatar);
  return router;
};
