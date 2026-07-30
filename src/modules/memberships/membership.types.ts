import type { Types } from "mongoose";

export const MembershipRole = {
  OWNER: "OWNER",
  MEMBER: "MEMBER",
} as const;

export type MembershipRole =
  (typeof MembershipRole)[keyof typeof MembershipRole];

export interface Membership {
  userId: Types.ObjectId;
  organizationId: Types.ObjectId;
  role: MembershipRole;
  joinedAt: Date;
}

export interface MembershipRecord {
  id: string;
  userId: string;
  organizationId: string;
  role: MembershipRole;
  joinedAt: Date;
}

export interface CreateMembershipInput {
  userId: string;
  organizationId: string;
  role: MembershipRole;
}
