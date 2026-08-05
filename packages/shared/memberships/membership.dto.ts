import { z } from "zod";

import { dateTimeDtoSchema, identifierDtoSchema } from "../common/index.js";
import { publicUserSummaryDtoSchema } from "../users/index.js";

export const MembershipRole = {
  OWNER: "OWNER",
  MEMBER: "MEMBER",
} as const;

export const membershipRoleSchema = z.enum(MembershipRole);

export const membershipDtoSchema = z.object({
  id: identifierDtoSchema,
  userId: identifierDtoSchema,
  organizationId: identifierDtoSchema,
  role: membershipRoleSchema,
  joinedAt: dateTimeDtoSchema,
});

export const membershipResponseSchema = z.object({
  membership: membershipDtoSchema,
});

export const PresenceStatus = {
  ONLINE: "ONLINE",
  OFFLINE: "OFFLINE",
} as const;

export const presenceStatusSchema = z.enum(PresenceStatus);

export const memberUserDtoSchema = publicUserSummaryDtoSchema.extend({
  status: presenceStatusSchema,
  lastSeenAt: dateTimeDtoSchema.nullable(),
});

export const organizationMemberDtoSchema = z.object({
  membershipId: identifierDtoSchema,
  role: membershipRoleSchema,
  joinedAt: dateTimeDtoSchema,
  user: memberUserDtoSchema,
});

export const organizationMemberListResponseSchema = z.object({
  members: z.array(organizationMemberDtoSchema),
});

export type MembershipRoleValue = z.infer<typeof membershipRoleSchema>;
export type MembershipDto = z.infer<typeof membershipDtoSchema>;
export type MembershipResponse = z.infer<typeof membershipResponseSchema>;
export type PresenceStatusValue = z.infer<typeof presenceStatusSchema>;
export type MemberUserDto = z.infer<typeof memberUserDtoSchema>;
export type OrganizationMemberDto = z.infer<typeof organizationMemberDtoSchema>;
export type OrganizationMemberListResponse = z.infer<
  typeof organizationMemberListResponseSchema
>;
