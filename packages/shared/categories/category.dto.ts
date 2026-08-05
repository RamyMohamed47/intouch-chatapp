import { z } from "zod";

import { dateTimeDtoSchema, identifierDtoSchema } from "../common/index.js";

export const categoryDtoSchema = z.object({
  id: identifierDtoSchema,
  organizationId: identifierDtoSchema,
  name: z.string(),
  position: z.number().int().nonnegative(),
  createdAt: dateTimeDtoSchema,
  updatedAt: dateTimeDtoSchema,
});

export const categoryResponseSchema = z.object({
  category: categoryDtoSchema,
});

export const categoryListResponseSchema = z.object({
  categories: z.array(categoryDtoSchema),
});

export type CategoryDto = z.infer<typeof categoryDtoSchema>;
export type CategoryResponse = z.infer<typeof categoryResponseSchema>;
export type CategoryListResponse = z.infer<typeof categoryListResponseSchema>;
