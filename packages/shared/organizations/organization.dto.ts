import { z } from "zod";

import { dateTimeDtoSchema, identifierDtoSchema } from "../common/index.js";
import { membershipRoleSchema } from "../memberships/membership.dto.js";
import { OrganizationVisibility } from "./organization.schema.js";

export const publicOrganizationDtoSchema = z.object({
  id: identifierDtoSchema,
  name: z.string(),
  slug: z.string(),
  logoUrl: z.string().url().optional(),
  visibility: z.enum(OrganizationVisibility),
  currentUserRole: membershipRoleSchema.nullable(),
  createdAt: dateTimeDtoSchema,
  updatedAt: dateTimeDtoSchema,
});

export const organizationResponseSchema = z.object({
  organization: publicOrganizationDtoSchema,
});

export const organizationListResponseSchema = z.object({
  organizations: z.array(publicOrganizationDtoSchema),
});

export type PublicOrganizationDto = z.infer<typeof publicOrganizationDtoSchema>;
export type OrganizationResponse = z.infer<typeof organizationResponseSchema>;
export type OrganizationListResponse = z.infer<
  typeof organizationListResponseSchema
>;
