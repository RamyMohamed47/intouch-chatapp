import {
  notificationListResponseSchema,
  notificationResponseSchema,
  type NotificationStatusValue,
} from "@intouch/shared/notifications";

import { apiRequest, noContentSchema } from "@/core/api/client";

export const notificationsApi = {
  list(status: NotificationStatusValue, cursor?: string) {
    const query = new URLSearchParams({ status, limit: "20" });
    if (cursor) query.set("cursor", cursor);
    return apiRequest(
      `/api/v1/notifications?${query.toString()}`,
      notificationListResponseSchema,
    );
  },
  async markRead(notificationId: string) {
    return (
      await apiRequest(
        `/api/v1/notifications/${notificationId}/read`,
        notificationResponseSchema,
        { method: "PUT" },
      )
    ).notification;
  },
  markAllRead() {
    return apiRequest("/api/v1/notifications/read-all", noContentSchema, {
      method: "PUT",
    });
  },
};
