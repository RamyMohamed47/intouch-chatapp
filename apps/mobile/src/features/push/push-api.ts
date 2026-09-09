import {
  pushDeviceResponseSchema,
  type RegisterPushDeviceInput,
} from "@intouch/shared/push";

import { apiRequest, noContentSchema } from "@/core/api/client";

export const pushApi = {
  register(installationId: string, input: RegisterPushDeviceInput) {
    return apiRequest(
      `/api/v1/users/me/push-devices/${installationId}`,
      pushDeviceResponseSchema,
      { method: "PUT", body: JSON.stringify(input) },
    );
  },
  remove(installationId: string) {
    return apiRequest(
      `/api/v1/users/me/push-devices/${installationId}`,
      noContentSchema,
      { method: "DELETE" },
    );
  },
};
