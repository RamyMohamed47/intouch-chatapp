import {
  organizationSearchResponseSchema,
  type OrganizationSearchQuery,
} from "@intouch/shared/search";

import { apiRequest } from "@/lib/api/client";

export const searchApi = {
  search(
    organizationId: string,
    input: Omit<OrganizationSearchQuery, "cursor"> & { cursor?: string },
  ) {
    const query = new URLSearchParams({
      q: input.q,
      type: input.type,
      limit: String(input.limit),
    });
    if (input.conversationId) {
      query.set("conversationId", input.conversationId);
    }
    if (input.cursor) query.set("cursor", input.cursor);
    return apiRequest(
      `/api/v1/organizations/${organizationId}/search?${query.toString()}`,
      organizationSearchResponseSchema,
    );
  },
};
