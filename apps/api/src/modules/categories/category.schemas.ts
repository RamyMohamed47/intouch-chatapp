import {
  createCategorySchema,
  updateCategorySchema,
} from "@intouch/shared/categories";
import { z } from "zod";

const mongoId = (label: string) =>
  z.string().regex(/^[a-f\d]{24}$/i, `${label} must be a valid MongoDB ID`);

export { createCategorySchema, updateCategorySchema };

export const organizationCategoryParamsSchema = z
  .object({
    organizationId: mongoId("Organization ID"),
    categoryId: mongoId("Category ID"),
  })
  .strict();

export const organizationCategoriesParamsSchema = z
  .object({ organizationId: mongoId("Organization ID") })
  .strict();

export type OrganizationCategoryParams = z.infer<
  typeof organizationCategoryParamsSchema
>;
export type OrganizationCategoriesParams = z.infer<
  typeof organizationCategoriesParamsSchema
>;
