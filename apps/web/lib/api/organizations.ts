import {
  organizationListResponseSchema,
  organizationResponseSchema,
  type CreateOrganizationInput,
  type UpdateOrganizationInput,
} from "@intouch/shared/organizations";
import { membershipResponseSchema } from "@intouch/shared/memberships";

import { apiRequest, noContentSchema } from "@/lib/api/client";

export const organizationsApi = {
  async list() {
    return (
      await apiRequest("/api/v1/organizations", organizationListResponseSchema)
    ).organizations;
  },
  async get(organizationId: string) {
    return (
      await apiRequest(
        `/api/v1/organizations/${organizationId}`,
        organizationResponseSchema,
      )
    ).organization;
  },
  async create(input: CreateOrganizationInput) {
    return (
      await apiRequest("/api/v1/organizations", organizationResponseSchema, {
        method: "POST",
        body: JSON.stringify(input),
      })
    ).organization;
  },
  async update(organizationId: string, input: UpdateOrganizationInput) {
    return (
      await apiRequest(
        `/api/v1/organizations/${organizationId}`,
        organizationResponseSchema,
        { method: "PATCH", body: JSON.stringify(input) },
      )
    ).organization;
  },
  async setLogo(organizationId: string, uploadId: string) {
    return (
      await apiRequest(
        `/api/v1/organizations/${organizationId}/logo`,
        organizationResponseSchema,
        { method: "PUT", body: JSON.stringify({ uploadId }) },
      )
    ).organization;
  },
  async removeLogo(organizationId: string) {
    return (
      await apiRequest(
        `/api/v1/organizations/${organizationId}/logo`,
        organizationResponseSchema,
        { method: "DELETE" },
      )
    ).organization;
  },
  remove(organizationId: string) {
    return apiRequest(
      `/api/v1/organizations/${organizationId}`,
      noContentSchema,
      { method: "DELETE" },
    );
  },
  async join(organizationId: string) {
    return (
      await apiRequest(
        `/api/v1/organizations/${organizationId}/join`,
        membershipResponseSchema,
        { method: "POST" },
      )
    ).membership;
  },
};
