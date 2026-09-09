import {
  NotificationType,
  type NotificationDto,
} from "@intouch/shared/notifications";
import type { Href } from "expo-router";

export const notificationCopy = (notification: NotificationDto) => {
  switch (notification.type) {
    case NotificationType.ORGANIZATION_INVITATION_RECEIVED:
      return {
        title: `${notification.actor.displayName} invited you`,
        description: `Join ${notification.organization.name} as a member.`,
      };
    case NotificationType.ORGANIZATION_INVITATION_ACCEPTED:
      return {
        title: `${notification.actor.displayName} accepted your invitation`,
        description: `They joined ${notification.organization.name}.`,
      };
    case NotificationType.DIRECT_MESSAGE_RECEIVED:
      return {
        title: `${notification.actor.displayName} sent ${
          notification.messageCount === 1
            ? "a direct message"
            : `${notification.messageCount} direct messages`
        }`,
        description: `Open the conversation in ${notification.organization.name}.`,
      };
    case NotificationType.MESSAGE_REACTION_RECEIVED:
      return {
        title: `${notification.actor.displayName} reacted ${notification.emoji}`,
        description: `They reacted to your message in ${notification.organization.name}.`,
      };
    case NotificationType.CHANNEL_MENTION_RECEIVED:
      return {
        title: `${notification.actor.displayName} mentioned you`,
        description: `Open the message in ${notification.organization.name}.`,
      };
    case NotificationType.MESSAGE_REPLY_RECEIVED:
      return {
        title: `${notification.actor.displayName} replied to you`,
        description: `Open the reply in ${notification.organization.name}.`,
      };
  }
};

export const notificationHref = (notification: NotificationDto): Href => {
  switch (notification.type) {
    case NotificationType.ORGANIZATION_INVITATION_RECEIVED:
      return "/workspaces";
    case NotificationType.ORGANIZATION_INVITATION_ACCEPTED:
      return {
        pathname: "/workspace/[organizationId]",
        params: { organizationId: notification.organization.id },
      };
    case NotificationType.DIRECT_MESSAGE_RECEIVED:
      return {
        pathname: "/conversation/[conversationId]",
        params: {
          conversationId: notification.conversationId,
          messageId: notification.latestMessageId,
        },
      };
    case NotificationType.MESSAGE_REACTION_RECEIVED:
    case NotificationType.CHANNEL_MENTION_RECEIVED:
    case NotificationType.MESSAGE_REPLY_RECEIVED:
      return {
        pathname: "/conversation/[conversationId]",
        params: {
          conversationId: notification.conversationId,
          messageId: notification.messageId,
        },
      };
  }
};

export const relativeNotificationTime = (value: string, now = Date.now()) => {
  const elapsed = Math.max(0, now - new Date(value).getTime());
  if (elapsed < 60_000) return "Just now";
  if (elapsed < 3_600_000) return `${Math.floor(elapsed / 60_000)}m ago`;
  if (elapsed < 86_400_000) return `${Math.floor(elapsed / 3_600_000)}h ago`;
  return `${Math.floor(elapsed / 86_400_000)}d ago`;
};
