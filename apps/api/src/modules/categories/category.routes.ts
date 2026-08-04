import express, { type RequestHandler } from "express";

import {
  validateBody,
  validateParams,
} from "../../middleware/validateRequest.js";
import type { CategoryController } from "./category.controller.js";
import {
  createCategorySchema,
  organizationCategoriesParamsSchema,
  organizationCategoryParamsSchema,
  updateCategorySchema,
} from "./category.schemas.js";

const createCategoryRouter = (
  controller: CategoryController,
  requireAccessToken: RequestHandler,
) => {
  const router = express.Router();
  router.use(requireAccessToken);
  router
    .route("/:organizationId/categories")
    .get(validateParams(organizationCategoriesParamsSchema), controller.list)
    .post(
      validateParams(organizationCategoriesParamsSchema),
      validateBody(createCategorySchema),
      controller.create,
    );
  router
    .route("/:organizationId/categories/:categoryId")
    .patch(
      validateParams(organizationCategoryParamsSchema),
      validateBody(updateCategorySchema),
      controller.update,
    )
    .delete(
      validateParams(organizationCategoryParamsSchema),
      controller.delete,
    );
  return router;
};

export default createCategoryRouter;
