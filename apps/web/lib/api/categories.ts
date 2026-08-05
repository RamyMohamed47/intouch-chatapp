import {
  categoryListResponseSchema,
  categoryResponseSchema,
  type CreateCategoryInput,
  type UpdateCategoryInput,
} from "@intouch/shared/categories";

import { apiRequest, noContentSchema } from "@/lib/api/client";

export const categoriesApi = {
  async list(organizationId: string) {
    return (
      await apiRequest(
        `/api/v1/organizations/${organizationId}/categories`,
        categoryListResponseSchema,
      )
    ).categories;
  },
  async create(organizationId: string, input: CreateCategoryInput) {
    return (
      await apiRequest(
        `/api/v1/organizations/${organizationId}/categories`,
        categoryResponseSchema,
        { method: "POST", body: JSON.stringify(input) },
      )
    ).category;
  },
  async update(
    organizationId: string,
    categoryId: string,
    input: UpdateCategoryInput,
  ) {
    return (
      await apiRequest(
        `/api/v1/organizations/${organizationId}/categories/${categoryId}`,
        categoryResponseSchema,
        { method: "PATCH", body: JSON.stringify(input) },
      )
    ).category;
  },
  remove(organizationId: string, categoryId: string) {
    return apiRequest(
      `/api/v1/organizations/${organizationId}/categories/${categoryId}`,
      noContentSchema,
      { method: "DELETE" },
    );
  },
};
