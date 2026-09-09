import {
  pushDeviceResponseSchema,
  type RegisterPushDeviceInput,
} from "@intouch/shared/push";
import type { RequestHandler } from "express";

import UnauthorizedError from "../../errors/UnauthorizedError.js";
import catchAsync from "../../utils/catchAsync.js";
import type { AuthLocals } from "../auth/auth.types.js";
import type { PushDeviceService } from "./push-device.service.js";

export interface PushDeviceController {
  register: RequestHandler;
  remove: RequestHandler;
}

const userIdFrom = (locals: AuthLocals) => {
  if (!locals.userId) throw new UnauthorizedError();
  return locals.userId;
};

const installationIdFrom = (value: string | string[] | undefined) => {
  if (typeof value !== "string")
    throw new Error("Validated installation ID missing");
  return value;
};

export const createPushDeviceController = (
  service: PushDeviceService,
): PushDeviceController => ({
  register: catchAsync(async (req, res) => {
    const pushDevice = await service.register(
      userIdFrom(res.locals as AuthLocals),
      installationIdFrom(req.params.installationId),
      req.body as RegisterPushDeviceInput,
    );
    res.status(200).json(pushDeviceResponseSchema.parse({ pushDevice }));
  }),
  remove: catchAsync(async (req, res) => {
    await service.remove(
      userIdFrom(res.locals as AuthLocals),
      installationIdFrom(req.params.installationId),
    );
    res.status(204).send();
  }),
});
