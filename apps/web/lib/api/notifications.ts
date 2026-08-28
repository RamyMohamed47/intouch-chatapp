import {
  notificationListResponseSchema,
  notificationResponseSchema,
  type NotificationStatusValue,
} from "@intouch/shared/notifications";

import { apiRequest, noContentSchema } from "@/lib/api/client";

export const notificationsApi = {
  list(options: {
    status: NotificationStatusValue;
    cursor?: string;
    limit?: number;
  }) {
    const query = new URLSearchParams({ status: options.status });
    if (options.cursor) query.set("cursor", options.cursor);
    if (options.limit) query.set("limit", String(options.limit));
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
