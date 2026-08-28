import {
  organizationSearchResponseSchema,
  type OrganizationSearchQuery,
} from "@intouch/shared/search";
import type { RequestHandler } from "express";

import UnauthorizedError from "../../errors/UnauthorizedError.js";
import catchAsync from "../../utils/catchAsync.js";
import type { AuthLocals } from "../auth/auth.types.js";
import type { OrganizationSearchParams } from "./search.schemas.js";
import type { SearchService } from "./search.service.js";

export interface SearchController {
  search: RequestHandler;
}

const createSearchController = (service: SearchService): SearchController => ({
  search: catchAsync(async (req, res) => {
    const userId = (res.locals as AuthLocals).userId;
    if (!userId) throw new UnauthorizedError();
    const { organizationId } =
      req.params as unknown as OrganizationSearchParams;
    const result = await service.search(
      userId,
      organizationId,
      (res.locals as { validatedQuery: OrganizationSearchQuery })
        .validatedQuery,
    );
    res.status(200).json(organizationSearchResponseSchema.parse(result));
  }),
});

export default createSearchController;
