import {
  notificationPreferencesResponseSchema,
  notificationListResponseSchema,
  notificationResponseSchema,
  type NotificationCategoryPreferences,
  type NotificationMuteInput,
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
  async getPreferences() {
    return (
      await apiRequest(
        "/api/v1/users/me/notification-preferences",
        notificationPreferencesResponseSchema,
      )
    ).preferences;
  },
  async updatePreferences(categories: NotificationCategoryPreferences) {
    return (
      await apiRequest(
        "/api/v1/users/me/notification-preferences",
        notificationPreferencesResponseSchema,
        { method: "PUT", body: JSON.stringify({ categories }) },
      )
    ).preferences;
  },
  async muteOrganization(organizationId: string, input: NotificationMuteInput) {
    return (
      await apiRequest(
        `/api/v1/users/me/notification-mutes/organizations/${organizationId}`,
        notificationPreferencesResponseSchema,
        { method: "PUT", body: JSON.stringify(input) },
      )
    ).preferences;
  },
  async unmuteOrganization(organizationId: string) {
    return (
      await apiRequest(
        `/api/v1/users/me/notification-mutes/organizations/${organizationId}`,
        notificationPreferencesResponseSchema,
        { method: "DELETE" },
      )
    ).preferences;
  },
  async muteConversation(conversationId: string, input: NotificationMuteInput) {
    return (
      await apiRequest(
        `/api/v1/users/me/notification-mutes/conversations/${conversationId}`,
        notificationPreferencesResponseSchema,
        { method: "PUT", body: JSON.stringify(input) },
      )
    ).preferences;
  },
  async unmuteConversation(conversationId: string) {
    return (
      await apiRequest(
        `/api/v1/users/me/notification-mutes/conversations/${conversationId}`,
        notificationPreferencesResponseSchema,
        { method: "DELETE" },
      )
    ).preferences;
  },
};
