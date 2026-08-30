import express, { type RequestHandler } from "express";

import {
  validateBody,
  validateParams,
} from "../../middleware/validateRequest.js";
import type { OrganizationController } from "./organization.controller.js";
import {
  createOrganizationSchema,
  organizationIdParamsSchema,
  updateOrganizationLogoSchema,
  updateOrganizationSchema,
} from "./organization.schemas.js";

const createOrganizationRouter = (
  controller: OrganizationController,
  requireAccessToken: RequestHandler,
) => {
  const router = express.Router();

  router.use(requireAccessToken);
  router
    .route("/")
    .get(controller.list)
    .post(validateBody(createOrganizationSchema), controller.create);
  router
    .route("/:id/logo")
    .put(
      validateParams(organizationIdParamsSchema),
      validateBody(updateOrganizationLogoSchema),
      controller.setLogo,
    )
    .delete(validateParams(organizationIdParamsSchema), controller.removeLogo);
  router
    .route("/:id")
    .get(validateParams(organizationIdParamsSchema), controller.getById)
    .patch(
      validateParams(organizationIdParamsSchema),
      validateBody(updateOrganizationSchema),
      controller.update,
    )
    .delete(validateParams(organizationIdParamsSchema), controller.delete);

  return router;
};

export default createOrganizationRouter;
