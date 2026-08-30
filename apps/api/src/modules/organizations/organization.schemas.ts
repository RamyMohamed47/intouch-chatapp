import {
  createOrganizationSchema,
  updateOrganizationLogoSchema,
  updateOrganizationSchema,
} from "@intouch/shared/organizations";
import { z } from "zod";

export {
  createOrganizationSchema,
  updateOrganizationLogoSchema,
  updateOrganizationSchema,
};

export const organizationIdParamsSchema = z
  .object({
    id: z
      .string()
      .regex(/^[a-f\d]{24}$/i, "Organization ID must be a valid MongoDB ID"),
  })
  .strict();

export type OrganizationIdParams = z.infer<typeof organizationIdParamsSchema>;
