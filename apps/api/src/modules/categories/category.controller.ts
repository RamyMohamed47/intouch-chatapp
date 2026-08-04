import type { RequestHandler } from "express";

import UnauthorizedError from "../../errors/UnauthorizedError.js";
import type { AuthLocals } from "../auth/auth.types.js";
import catchAsync from "../../utils/catchAsync.js";
import type {
  CreateCategoryInput,
  UpdateCategoryInput,
} from "./category.types.js";
import type {
  OrganizationCategoriesParams,
  OrganizationCategoryParams,
} from "./category.schemas.js";
import type { CategoryService } from "./category.service.js";

const getUserId = (locals: AuthLocals) => {
  if (!locals.userId) throw new UnauthorizedError();
  return locals.userId;
};

export interface CategoryController {
  create: RequestHandler;
  list: RequestHandler;
  update: RequestHandler;
  delete: RequestHandler;
}

const createCategoryController = (
  service: CategoryService,
): CategoryController => ({
  create: catchAsync(async (req, res) => {
    const { organizationId } =
      req.params as unknown as OrganizationCategoriesParams;
    const category = await service.create(
      getUserId(res.locals as AuthLocals),
      organizationId,
      req.body as CreateCategoryInput,
    );
    res.status(201).json({ category });
  }),

  list: catchAsync(async (req, res) => {
    const { organizationId } =
      req.params as unknown as OrganizationCategoriesParams;
    const categories = await service.list(
      getUserId(res.locals as AuthLocals),
      organizationId,
    );
    res.status(200).json({ categories });
  }),

  update: catchAsync(async (req, res) => {
    const { categoryId, organizationId } =
      req.params as unknown as OrganizationCategoryParams;
    const category = await service.update(
      getUserId(res.locals as AuthLocals),
      organizationId,
      categoryId,
      req.body as UpdateCategoryInput,
    );
    res.status(200).json({ category });
  }),

  delete: catchAsync(async (req, res) => {
    const { categoryId, organizationId } =
      req.params as unknown as OrganizationCategoryParams;
    await service.delete(
      getUserId(res.locals as AuthLocals),
      organizationId,
      categoryId,
    );
    res.status(204).send();
  }),
});

export default createCategoryController;
