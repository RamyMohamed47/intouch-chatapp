import {
  organizationListResponseSchema,
  organizationResponseSchema,
  type CreateOrganizationInput,
  type UpdateOrganizationInput,
} from "@intouch/shared/organizations";
import {
  invitationListResponseSchema,
  invitationResponseSchema,
  membershipResponseSchema,
  organizationMemberListResponseSchema,
  type InviteMemberInput,
} from "@intouch/shared/memberships";
import {
  categoryListResponseSchema,
  categoryResponseSchema,
  type CreateCategoryInput,
  type UpdateCategoryInput,
} from "@intouch/shared/categories";

import { apiRequest, noContentSchema } from "@/core/api/client";

export const organizationsApi = {
  list: async () =>
    (await apiRequest("/api/v1/organizations", organizationListResponseSchema))
      .organizations,
  get: async (id: string) =>
    (
      await apiRequest(
        `/api/v1/organizations/${id}`,
        organizationResponseSchema,
      )
    ).organization,
  create: async (input: CreateOrganizationInput) =>
    (
      await apiRequest("/api/v1/organizations", organizationResponseSchema, {
        method: "POST",
        body: JSON.stringify(input),
      })
    ).organization,
  update: async (id: string, input: UpdateOrganizationInput) =>
    (
      await apiRequest(
        `/api/v1/organizations/${id}`,
        organizationResponseSchema,
        { method: "PATCH", body: JSON.stringify(input) },
      )
    ).organization,
  remove: (id: string) =>
    apiRequest(`/api/v1/organizations/${id}`, noContentSchema, {
      method: "DELETE",
    }),
  members: async (id: string) =>
    (
      await apiRequest(
        `/api/v1/organizations/${id}/members`,
        organizationMemberListResponseSchema,
      )
    ).members,
  invite: async (id: string, input: InviteMemberInput) =>
    (
      await apiRequest(
        `/api/v1/organizations/${id}/invitations`,
        invitationResponseSchema,
        { method: "POST", body: JSON.stringify(input) },
      )
    ).invitation,
  invitations: async () =>
    (await apiRequest("/api/v1/invitations", invitationListResponseSchema))
      .invitations,
  acceptInvitation: async (id: string) =>
    (
      await apiRequest(
        `/api/v1/invitations/${id}/accept`,
        membershipResponseSchema,
        { method: "POST" },
      )
    ).membership,
  declineInvitation: (id: string) =>
    apiRequest(`/api/v1/invitations/${id}`, noContentSchema, {
      method: "DELETE",
    }),
  categories: async (organizationId: string) =>
    (
      await apiRequest(
        `/api/v1/organizations/${organizationId}/categories`,
        categoryListResponseSchema,
      )
    ).categories,
  createCategory: async (organizationId: string, input: CreateCategoryInput) =>
    (
      await apiRequest(
        `/api/v1/organizations/${organizationId}/categories`,
        categoryResponseSchema,
        { method: "POST", body: JSON.stringify(input) },
      )
    ).category,
  updateCategory: async (
    organizationId: string,
    categoryId: string,
    input: UpdateCategoryInput,
  ) =>
    (
      await apiRequest(
        `/api/v1/organizations/${organizationId}/categories/${categoryId}`,
        categoryResponseSchema,
        { method: "PATCH", body: JSON.stringify(input) },
      )
    ).category,
  removeCategory: (organizationId: string, categoryId: string) =>
    apiRequest(
      `/api/v1/organizations/${organizationId}/categories/${categoryId}`,
      noContentSchema,
      { method: "DELETE" },
    ),
};
