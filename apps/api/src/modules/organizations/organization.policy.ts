import { OrganizationVisibility } from "@intouch/shared/organizations";

import { InvitationNotFoundError } from "../invitations/invitation.errors.js";
import type { InvitationRecord } from "../invitations/invitation.types.js";
import { MembershipConflictError } from "../memberships/membership.errors.js";
import {
  MembershipRole,
  type MembershipRecord,
} from "../memberships/membership.types.js";
import {
  OrganizationForbiddenError,
  OrganizationNotFoundError,
} from "./organization.errors.js";
import type { OrganizationRecord } from "./organization.types.js";

const createOrganizationPolicy = () => {
  const assertVisible = (
    organization: OrganizationRecord | null,
    membership: MembershipRecord | null,
  ) => {
    if (
      !organization ||
      (organization.visibility === OrganizationVisibility.PRIVATE &&
        !membership)
    ) {
      throw new OrganizationNotFoundError();
    }

    return organization;
  };

  const assertOwner = (
    organization: OrganizationRecord | null,
    membership: MembershipRecord | null,
  ) => {
    const visibleOrganization = assertVisible(organization, membership);

    if (membership?.role !== MembershipRole.OWNER) {
      throw new OrganizationForbiddenError();
    }

    return visibleOrganization;
  };

  return {
    assertVisible,
    assertOwner,
    assertCanInvite: assertOwner,

    assertMember(
      organization: OrganizationRecord | null,
      membership: MembershipRecord | null,
    ) {
      if (!organization || !membership) {
        throw new OrganizationNotFoundError();
      }

      return organization;
    },

    assertCanJoinPublic(
      organization: OrganizationRecord | null,
      membership: MembershipRecord | null,
    ) {
      if (!organization) {
        throw new OrganizationNotFoundError();
      }

      if (membership) {
        throw new MembershipConflictError();
      }

      if (organization.visibility !== OrganizationVisibility.PUBLIC) {
        throw new OrganizationNotFoundError();
      }

      return organization;
    },

    assertInvitationRecipient(
      invitation: InvitationRecord | null,
      userId: string,
      now: Date,
    ) {
      if (
        !invitation ||
        invitation.invitedUserId !== userId ||
        invitation.expiresAt <= now
      ) {
        throw new InvitationNotFoundError();
      }

      return invitation;
    },
  };
};

export type OrganizationPolicy = ReturnType<typeof createOrganizationPolicy>;

export default createOrganizationPolicy;
