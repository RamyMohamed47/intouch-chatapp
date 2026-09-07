import {
  assetAccessResponseSchema,
  completeUploadResponseSchema,
  createUploadResponseSchema,
  type CreateUploadInput,
} from "@intouch/shared/uploads";
import { organizationResponseSchema } from "@intouch/shared/organizations";
import { userResponseSchema } from "@intouch/shared/users";

import { apiRequest, noContentSchema } from "@/core/api/client";

export const uploadsApi = {
  create: (input: CreateUploadInput) =>
    apiRequest("/api/v1/uploads", createUploadResponseSchema, {
      method: "POST",
      body: JSON.stringify(input),
    }),
  complete: async (id: string) =>
    (
      await apiRequest(
        `/api/v1/uploads/${id}/complete`,
        completeUploadResponseSchema,
        { method: "POST" },
      )
    ).upload,
  cancel: (id: string) =>
    apiRequest(`/api/v1/uploads/${id}`, noContentSchema, { method: "DELETE" }),
  access: (id: string) =>
    apiRequest(`/api/v1/assets/${id}/access`, assetAccessResponseSchema),
  setAvatar: async (uploadId: string) =>
    (
      await apiRequest("/api/v1/users/me/avatar", userResponseSchema, {
        method: "PUT",
        body: JSON.stringify({ uploadId }),
      })
    ).user,
  removeAvatar: async () =>
    (
      await apiRequest("/api/v1/users/me/avatar", userResponseSchema, {
        method: "DELETE",
      })
    ).user,
  setOrganizationLogo: async (organizationId: string, uploadId: string) =>
    (
      await apiRequest(
        `/api/v1/organizations/${organizationId}/logo`,
        organizationResponseSchema,
        { method: "PUT", body: JSON.stringify({ uploadId }) },
      )
    ).organization,
  removeOrganizationLogo: async (organizationId: string) =>
    (
      await apiRequest(
        `/api/v1/organizations/${organizationId}/logo`,
        organizationResponseSchema,
        { method: "DELETE" },
      )
    ).organization,
};
