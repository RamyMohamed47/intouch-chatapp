import { z } from "zod";

import { dateTimeDtoSchema, identifierDtoSchema } from "../common/index.js";
import { OrganizationVisibility } from "../organizations/organization.schema.js";

export const invitationOrganizationSummaryDtoSchema = z.object({
  id: identifierDtoSchema,
  name: z.string(),
  slug: z.string(),
  logoAssetId: identifierDtoSchema.nullable(),
  visibility: z.enum(OrganizationVisibility),
});

export const invitationDtoSchema = z.object({
  id: identifierDtoSchema,
  organizationId: identifierDtoSchema,
  invitedUserId: identifierDtoSchema,
  invitedByUserId: identifierDtoSchema,
  expiresAt: dateTimeDtoSchema,
  createdAt: dateTimeDtoSchema,
  organization: invitationOrganizationSummaryDtoSchema,
});

export const invitationResponseSchema = z.object({
  invitation: invitationDtoSchema,
});

export const invitationListResponseSchema = z.object({
  invitations: z.array(invitationDtoSchema),
});

export type InvitationOrganizationSummaryDto = z.infer<
  typeof invitationOrganizationSummaryDtoSchema
>;
export type InvitationDto = z.infer<typeof invitationDtoSchema>;
export type InvitationResponse = z.infer<typeof invitationResponseSchema>;
export type InvitationListResponse = z.infer<
  typeof invitationListResponseSchema
>;
