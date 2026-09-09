import {
  pushInstallationIdSchema,
  registerPushDeviceSchema,
} from "@intouch/shared/push";
import express, { type RequestHandler } from "express";
import { z } from "zod";

import {
  validateBody,
  validateParams,
} from "../../middleware/validateRequest.js";
import type { PushDeviceController } from "./push-device.controller.js";

const paramsSchema = z
  .object({ installationId: pushInstallationIdSchema })
  .strict();

export const createPushDeviceRouter = (
  controller: PushDeviceController,
  requireAccessToken: RequestHandler,
  mutateLimit: RequestHandler,
) => {
  const router = express.Router();
  router.use(requireAccessToken);
  router.put(
    "/me/push-devices/:installationId",
    mutateLimit,
    validateParams(paramsSchema),
    validateBody(registerPushDeviceSchema),
    controller.register,
  );
  router.delete(
    "/me/push-devices/:installationId",
    mutateLimit,
    validateParams(paramsSchema),
    controller.remove,
  );
  return router;
};
