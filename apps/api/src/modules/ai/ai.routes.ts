import express, { type RequestHandler } from "express";

import {
  validateBody,
  validateParams,
} from "../../middleware/validateRequest.js";
import type { AiController } from "./ai.controller.js";
import {
  aiConsentUpdateSchema,
  aiOrganizationParamsSchema,
  aiOrganizationSettingsUpdateSchema,
  aiResponseRequestSchema,
} from "./ai.schemas.js";

const createAiRouter = (
  controller: AiController,
  requireAccessToken: RequestHandler,
  aiLimit: RequestHandler,
) => {
  const router = express.Router();
  router.use(
    "/:organizationId/ai",
    requireAccessToken,
    validateParams(aiOrganizationParamsSchema),
  );
  router
    .route("/:organizationId/ai/settings")
    .get(controller.getSettings)
    .put(
      validateBody(aiOrganizationSettingsUpdateSchema),
      controller.updateSettings,
    );
  router
    .route("/:organizationId/ai/consent")
    .put(validateBody(aiConsentUpdateSchema), controller.acceptConsent)
    .delete(controller.revokeConsent);
  router.post(
    "/:organizationId/ai/responses",
    aiLimit,
    validateBody(aiResponseRequestSchema),
    controller.createResponse,
  );
  return router;
};

export default createAiRouter;
