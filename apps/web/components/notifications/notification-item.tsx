"use client";

import type { NotificationDto } from "@intouch/shared/notifications";
import { NotificationType } from "@intouch/shared/notifications";
import {
  MailPlus,
  MessageCircleMore,
  SmilePlus,
  UserCheck,
} from "lucide-react";

import { UserAvatar } from "@/components/users/user-avatar";
import { cn } from "@/lib/utils";

export const notificationHref = (notification: NotificationDto) => {
  switch (notification.type) {
    case NotificationType.ORGANIZATION_INVITATION_RECEIVED:
      return "/app/invitations";
    case NotificationType.ORGANIZATION_INVITATION_ACCEPTED:
      return `/app/${notification.organization.id}`;
    case NotificationType.DIRECT_MESSAGE_RECEIVED:
      return `/app/${notification.organization.id}/direct-messages/${notification.conversationId}?messageId=${notification.latestMessageId}`;
    case NotificationType.MESSAGE_REACTION_RECEIVED:
      return `/app/${notification.organization.id}/${
        notification.conversationType === "DIRECT"
          ? "direct-messages"
          : "channels"
      }/${notification.conversationId}?messageId=${notification.messageId}`;
  }
};

const notificationCopy = (notification: NotificationDto) => {
  switch (notification.type) {
    case NotificationType.ORGANIZATION_INVITATION_RECEIVED:
      return {
        title: `${notification.actor.displayName} invited you`,
        description: `Join ${notification.organization.name} as a member.`,
        icon: MailPlus,
      };
    case NotificationType.ORGANIZATION_INVITATION_ACCEPTED:
      return {
        title: `${notification.actor.displayName} accepted your invitation`,
        description: `They joined ${notification.organization.name}.`,
        icon: UserCheck,
      };
    case NotificationType.DIRECT_MESSAGE_RECEIVED:
      return {
        title: `${notification.actor.displayName} sent ${
          notification.messageCount === 1
            ? "a direct message"
            : `${notification.messageCount} direct messages`
        }`,
        description: `Open the conversation in ${notification.organization.name}.`,
        icon: MessageCircleMore,
      };
    case NotificationType.MESSAGE_REACTION_RECEIVED:
      return {
        title: `${notification.actor.displayName} reacted ${notification.emoji}`,
        description: `They reacted to your message in ${notification.organization.name}.`,
        icon: SmilePlus,
      };
  }
};

const timeLabel = (value: string) => {
  const date = new Date(value);
  const elapsed = Date.now() - date.getTime();
  if (elapsed < 60_000) return "Just now";
  if (elapsed < 3_600_000) return `${Math.floor(elapsed / 60_000)}m ago`;
  if (elapsed < 86_400_000) return `${Math.floor(elapsed / 3_600_000)}h ago`;
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
  }).format(date);
};

export function NotificationItem({
  notification,
  onSelect,
}: {
  notification: NotificationDto;
  onSelect: (notification: NotificationDto) => void;
}) {
  const copy = notificationCopy(notification);
  const Icon = copy.icon;
  const unread = notification.readAt === null;

  return (
    <button
      type="button"
      onClick={() => onSelect(notification)}
      className={cn(
        "group relative flex w-full gap-3 rounded-2xl border p-3 text-left outline-none transition-colors hover:bg-accent/60 focus-visible:ring-2 focus-visible:ring-ring",
        unread
          ? "border-primary/20 bg-primary/8"
          : "border-transparent bg-transparent",
      )}
    >
      <UserAvatar
        size="lg"
        displayName={notification.actor.displayName}
        avatarAssetId={notification.actor.avatarAssetId}
        avatarUrl={notification.actor.avatarUrl}
      />
      <span className="min-w-0 flex-1">
        <span className="flex items-start gap-2">
          <span className="line-clamp-2 flex-1 text-sm font-medium">
            {copy.title}
          </span>
          <Icon className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />
        </span>
        <span className="mt-1 line-clamp-2 block text-xs leading-5 text-muted-foreground">
          {copy.description}
        </span>
        <span className="mt-1.5 block font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
          {timeLabel(notification.lastActivityAt)}
        </span>
      </span>
      {unread && (
        <span
          className="absolute top-3 right-3 size-2 rounded-full bg-primary"
          aria-label="Unread"
        />
      )}
    </button>
  );
}
