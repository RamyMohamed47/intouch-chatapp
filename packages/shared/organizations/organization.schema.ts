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

const logoUrlSchema = z
  .string()
  .trim()
  .url("Logo URL must be a valid URL")
  .refine((value) => {
    const protocol = new URL(value).protocol;
    return protocol === "http:" || protocol === "https:";
  }, "Logo URL must use HTTP or HTTPS");

export const createOrganizationSchema = z
  .object({
    name: organizationNameSchema,
    logoUrl: logoUrlSchema.optional(),
    visibility: z
      .enum([OrganizationVisibility.PRIVATE, OrganizationVisibility.PUBLIC])
      .default(OrganizationVisibility.PRIVATE),
  })
  .strict();

export const updateOrganizationSchema = z
  .object({
    name: organizationNameSchema.optional(),
    logoUrl: logoUrlSchema.nullable().optional(),
    visibility: z
      .enum([OrganizationVisibility.PRIVATE, OrganizationVisibility.PUBLIC])
      .optional(),
  })
  .strict()
  .refine(
    (input) => Object.values(input).some((value) => value !== undefined),
    "At least one organization field is required",
  );

export type CreateOrganizationInput = z.infer<typeof createOrganizationSchema>;
export type UpdateOrganizationInput = z.infer<typeof updateOrganizationSchema>;
