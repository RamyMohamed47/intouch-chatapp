import type {
  CreateOrganizationInput,
  OrganizationVisibilityType,
  UpdateOrganizationInput,
} from "@intouch/shared/organizations";

import type { MembershipRole } from "../memberships/index.js";

export interface Organization {
  name: string;
  slug: string;
  logoUrl?: string;
  visibility: OrganizationVisibilityType;
  mutationVersion?: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface OrganizationRecord extends Organization {
  id: string;
}

export interface PublicOrganization extends OrganizationRecord {
  currentUserRole: MembershipRole | null;
}

export interface CreateOrganizationRecordInput {
  name: string;
  slug: string;
  logoUrl?: string;
  visibility: OrganizationVisibilityType;
}

export interface UpdateOrganizationRecordInput {
  name?: string | undefined;
  logoUrl?: string | null | undefined;
  visibility?: OrganizationVisibilityType | undefined;
}

export type { CreateOrganizationInput, UpdateOrganizationInput };
