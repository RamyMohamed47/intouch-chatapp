import { z } from "zod";

const categoryNameSchema = z.string().trim().min(1).max(100);

export const createCategorySchema = z
  .object({
    name: categoryNameSchema,
  })
  .strict();

export const updateCategorySchema = z
  .object({
    name: categoryNameSchema.optional(),
    position: z.number().int().nonnegative().optional(),
  })
  .strict()
  .refine((input) => Object.keys(input).length > 0, {
    message: "At least one field is required",
  });

export type CreateCategoryInput = z.infer<typeof createCategorySchema>;
export type UpdateCategoryInput = z.infer<typeof updateCategorySchema>;
