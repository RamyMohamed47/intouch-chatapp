import express, { type RequestHandler } from "express";

import {
  validateParams,
  validateQuery,
} from "../../middleware/validateRequest.js";
import type { SearchController } from "./search.controller.js";
import {
  organizationSearchParamsSchema,
  organizationSearchQuerySchema,
} from "./search.schemas.js";

const createSearchRouter = (
  controller: SearchController,
  requireAccessToken: RequestHandler,
  searchLimit: RequestHandler,
) => {
  const router = express.Router();
  router.get(
    "/:organizationId/search",
    requireAccessToken,
    searchLimit,
    validateParams(organizationSearchParamsSchema),
    validateQuery(organizationSearchQuerySchema),
    controller.search,
  );
  return router;
};

export default createSearchRouter;
