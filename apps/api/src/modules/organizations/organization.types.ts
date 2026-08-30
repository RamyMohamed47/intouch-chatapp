import type {
  CreateOrganizationInput,
  OrganizationVisibilityType,
  UpdateOrganizationLogoInput,
  UpdateOrganizationInput,
} from "@intouch/shared/organizations";

import type { MembershipRole } from "../memberships/index.js";

export interface Organization {
  name: string;
  slug: string;
  logoAssetId?: string;
  visibility: OrganizationVisibilityType;
  mutationVersion?: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface OrganizationRecord extends Organization {
  id: string;
}

export interface PublicOrganization extends Omit<
  OrganizationRecord,
  "logoAssetId"
> {
  logoAssetId: string | null;
  currentUserRole: MembershipRole | null;
}

export interface CreateOrganizationRecordInput {
  name: string;
  slug: string;
  visibility: OrganizationVisibilityType;
}

export interface UpdateOrganizationRecordInput {
  name?: string | undefined;
  visibility?: OrganizationVisibilityType | undefined;
}

export type {
  CreateOrganizationInput,
  UpdateOrganizationInput,
  UpdateOrganizationLogoInput,
};
