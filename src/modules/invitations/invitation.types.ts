import type { OrganizationVisibilityType } from "@intouch/shared/organizations";
import type { Types } from "mongoose";

export interface Invitation {
  organizationId: Types.ObjectId;
  invitedUserId: Types.ObjectId;
  invitedByUserId: Types.ObjectId;
  expiresAt: Date;
  createdAt: Date;
}

export interface InvitationRecord {
  id: string;
  organizationId: string;
  invitedUserId: string;
  invitedByUserId: string;
  expiresAt: Date;
  createdAt: Date;
}

export interface CreateInvitationRecordInput {
  organizationId: string;
  invitedUserId: string;
  invitedByUserId: string;
  expiresAt: Date;
}

export interface InvitationOrganizationSummary {
  id: string;
  name: string;
  slug: string;
  logoUrl?: string;
  visibility: OrganizationVisibilityType;
}

export interface PublicInvitation extends InvitationRecord {
  organization: InvitationOrganizationSummary;
}
