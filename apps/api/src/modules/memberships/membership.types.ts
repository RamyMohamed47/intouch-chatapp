import type { Types } from "mongoose";
import {
  MembershipRole,
  type MembershipRoleValue,
} from "@intouch/shared/memberships";

export { MembershipRole };
export type MembershipRole = MembershipRoleValue;

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
