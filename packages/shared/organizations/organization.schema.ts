import { z } from "zod";

export const OrganizationVisibility = {
  PRIVATE: "PRIVATE",
  PUBLIC: "PUBLIC",
} as const;

export type OrganizationVisibility =
  (typeof OrganizationVisibility)[keyof typeof OrganizationVisibility];

const organizationNameSchema = z
  .string()
  .trim()
  .min(1, "Organization name is required")
  .max(100, "Organization name must be at most 100 characters");

const mongoIdSchema = z
  .string()
  .regex(/^[a-f\d]{24}$/i, "Must be a valid MongoDB ID");

export const createOrganizationSchema = z
  .object({
    name: organizationNameSchema,
    logoUploadId: mongoIdSchema.optional(),
    visibility: z
      .enum([OrganizationVisibility.PRIVATE, OrganizationVisibility.PUBLIC])
      .default(OrganizationVisibility.PRIVATE),
  })
  .strict();

export const updateOrganizationSchema = z
  .object({
    name: organizationNameSchema.optional(),
    visibility: z
      .enum([OrganizationVisibility.PRIVATE, OrganizationVisibility.PUBLIC])
      .optional(),
  })
  .strict()
  .refine(
    (input) => Object.values(input).some((value) => value !== undefined),
    "At least one organization field is required",
  );

export const updateOrganizationLogoSchema = z
  .object({ uploadId: mongoIdSchema })
  .strict();

export type CreateOrganizationInput = z.infer<typeof createOrganizationSchema>;
export type UpdateOrganizationInput = z.infer<typeof updateOrganizationSchema>;
export type UpdateOrganizationLogoInput = z.infer<
  typeof updateOrganizationLogoSchema
>;
