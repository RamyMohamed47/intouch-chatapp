import {
  assetAccessResponseSchema,
  completeUploadResponseSchema,
  createUploadResponseSchema,
  type CreateUploadInput,
} from "@intouch/shared/uploads";
import { userResponseSchema } from "@intouch/shared/users";

import { apiRequest, noContentSchema } from "@/lib/api/client";

export const uploadsApi = {
  create(input: CreateUploadInput) {
    return apiRequest("/api/v1/uploads", createUploadResponseSchema, {
      method: "POST",
      body: JSON.stringify(input),
    });
  },
  async complete(uploadId: string) {
    return (
      await apiRequest(
        `/api/v1/uploads/${uploadId}/complete`,
        completeUploadResponseSchema,
        { method: "POST" },
      )
    ).upload;
  },
  cancel(uploadId: string) {
    return apiRequest(`/api/v1/uploads/${uploadId}`, noContentSchema, {
      method: "DELETE",
    });
  },
  access(assetId: string) {
    return apiRequest(
      `/api/v1/assets/${assetId}/access`,
      assetAccessResponseSchema,
    );
  },
  async setAvatar(uploadId: string) {
    return (
      await apiRequest("/api/v1/users/me/avatar", userResponseSchema, {
        method: "PUT",
        body: JSON.stringify({ uploadId }),
      })
    ).user;
  },
  async removeAvatar() {
    return (
      await apiRequest("/api/v1/users/me/avatar", userResponseSchema, {
        method: "DELETE",
      })
    ).user;
  },
};
