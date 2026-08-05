import {
  invitationListResponseSchema,
  invitationResponseSchema,
  membershipResponseSchema,
  organizationMemberListResponseSchema,
  type InviteMemberInput,
} from "@intouch/shared/memberships";

import { apiRequest, noContentSchema } from "@/lib/api/client";

export const membershipsApi = {
  async listMembers(organizationId: string) {
    return (
      await apiRequest(
        `/api/v1/organizations/${organizationId}/members`,
        organizationMemberListResponseSchema,
      )
    ).members;
  },
  async invite(organizationId: string, input: InviteMemberInput) {
    return (
      await apiRequest(
        `/api/v1/organizations/${organizationId}/invitations`,
        invitationResponseSchema,
        { method: "POST", body: JSON.stringify(input) },
      )
    ).invitation;
  },
  async listInvitations() {
    return (
      await apiRequest("/api/v1/invitations", invitationListResponseSchema)
    ).invitations;
  },
  async acceptInvitation(invitationId: string) {
    return (
      await apiRequest(
        `/api/v1/invitations/${invitationId}/accept`,
        membershipResponseSchema,
        { method: "POST" },
      )
    ).membership;
  },
  declineInvitation(invitationId: string) {
    return apiRequest(`/api/v1/invitations/${invitationId}`, noContentSchema, {
      method: "DELETE",
    });
  },
};
