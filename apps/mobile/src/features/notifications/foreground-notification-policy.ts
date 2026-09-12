import {
  ConversationType,
  type ConversationTypeValue,
} from "@intouch/shared/conversations";
import {
  NotificationType,
  type NotificationPreferencesDto,
} from "@intouch/shared/notifications";

interface MessageBannerInput {
  conversationId: string;
  conversationType: ConversationTypeValue;
  now?: number;
  organizationId: string;
  preferences: NotificationPreferencesDto | null | undefined;
}

interface InterruptionScope {
  conversationId?: string;
  organizationId: string;
}

type InterruptionSource = "EXPO" | "SOCKET";

const isActiveMute = (mutedUntil: string | null, now: number) =>
  mutedUntil === null || new Date(mutedUntil).getTime() > now;

const isScopeMuted = (
  preferences: NotificationPreferencesDto,
  organizationId: string,
  conversationId: string | undefined,
  now: number,
) =>
  preferences.mutes.some(
    (mute) =>
      mute.organizationId === organizationId &&
      isActiveMute(mute.mutedUntil, now) &&
      (mute.conversationId === null ||
        (conversationId !== undefined &&
          mute.conversationId === conversationId)),
  );

export const shouldShowForegroundMessageBanner = ({
  conversationId,
  conversationType,
  now = Date.now(),
  organizationId,
  preferences,
}: MessageBannerInput) => {
  if (!preferences) return false;
  if (isScopeMuted(preferences, organizationId, conversationId, now)) {
    return false;
  }
  return (
    conversationType !== ConversationType.DIRECT ||
    preferences.categories.directMessages
  );
};

export const shouldShowForegroundPush = (
  data: Record<string, unknown>,
  preferences: NotificationPreferencesDto | null | undefined,
  now = Date.now(),
) => {
  if (!preferences) return false;
  const type = data.type;
  const organizationId = data.organizationId;
  const conversationId = data.conversationId;
  if (typeof type !== "string" || typeof organizationId !== "string") {
    return false;
  }

  if (type === NotificationType.ORGANIZATION_INVITATION_RECEIVED) {
    return preferences.categories.invitations;
  }
  if (
    isScopeMuted(
      preferences,
      organizationId,
      typeof conversationId === "string" ? conversationId : undefined,
      now,
    )
  ) {
    return false;
  }
  switch (type) {
    case NotificationType.ORGANIZATION_INVITATION_ACCEPTED:
      return preferences.categories.invitations;
    case NotificationType.DIRECT_MESSAGE_RECEIVED:
      return preferences.categories.directMessages;
    case NotificationType.CHANNEL_MENTION_RECEIVED:
    case NotificationType.MESSAGE_REPLY_RECEIVED:
      return preferences.categories.mentionsAndReplies;
    case NotificationType.MESSAGE_REACTION_RECEIVED:
      return preferences.categories.reactions;
    default:
      return false;
  }
};

class ForegroundInterruptionDeduper {
  private readonly recent = new Map<
    string,
    { source: InterruptionSource; timestamp: number }
  >();

  constructor(private readonly windowMs = 5_000) {}

  claim(
    scope: InterruptionScope,
    source: InterruptionSource,
    now = Date.now(),
  ) {
    for (const [key, interruption] of this.recent) {
      if (now - interruption.timestamp >= this.windowMs) {
        this.recent.delete(key);
      }
    }
    const key = scope.conversationId
      ? `conversation:${scope.conversationId}`
      : `organization:${scope.organizationId}`;
    const previous = this.recent.get(key);
    if (previous && previous.source !== source) return false;
    this.recent.set(key, { source, timestamp: now });
    return true;
  }

  clear() {
    this.recent.clear();
  }
}

export const createForegroundInterruptionDeduper = (windowMs?: number) =>
  new ForegroundInterruptionDeduper(windowMs);

export const foregroundInterruptionDeduper =
  createForegroundInterruptionDeduper();

let foregroundNotificationPreferences: NotificationPreferencesDto | null = null;

export const setForegroundNotificationPreferences = (
  preferences: NotificationPreferencesDto | null,
) => {
  foregroundNotificationPreferences = preferences;
};

export const getForegroundNotificationPreferences = () =>
  foregroundNotificationPreferences;
