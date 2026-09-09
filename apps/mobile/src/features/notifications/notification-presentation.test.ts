import {
  NotificationType,
  type NotificationDto,
} from "@intouch/shared/notifications";

import {
  notificationCopy,
  notificationHref,
  relativeNotificationTime,
} from "@/features/notifications/notification-presentation";

const notification: NotificationDto = {
  id: "507f1f77bcf86cd799439011",
  type: NotificationType.DIRECT_MESSAGE_RECEIVED,
  actor: {
    id: "507f1f77bcf86cd799439012",
    username: "alex",
    displayName: "Alex Rivera",
    avatarAssetId: null,
  },
  organization: {
    id: "507f1f77bcf86cd799439013",
    name: "Northstar",
    logoAssetId: null,
  },
  conversationId: "507f1f77bcf86cd799439014",
  latestMessageId: "507f1f77bcf86cd799439015",
  messageCount: 2,
  readAt: null,
  createdAt: "2026-09-08T12:00:00.000Z",
  lastActivityAt: "2026-09-08T12:00:00.000Z",
};

describe("mobile notification presentation", () => {
  it("uses safe activity copy and exact-message navigation", () => {
    expect(notificationCopy(notification).title).toBe(
      "Alex Rivera sent 2 direct messages",
    );
    expect(notificationHref(notification)).toEqual({
      pathname: "/conversation/[conversationId]",
      params: {
        conversationId: notification.conversationId,
        messageId: notification.latestMessageId,
      },
    });
  });

  it("formats recent activity without locale-dependent snapshots", () => {
    expect(
      relativeNotificationTime(
        notification.lastActivityAt,
        new Date("2026-09-08T12:05:00.000Z").getTime(),
      ),
    ).toBe("5m ago");
  });
});
