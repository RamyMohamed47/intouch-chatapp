import { ConversationType } from "@intouch/shared/conversations";
import {
  NotificationType,
  type NotificationPreferencesDto,
} from "@intouch/shared/notifications";

import {
  createForegroundInterruptionDeduper,
  shouldShowForegroundMessageBanner,
  shouldShowForegroundPush,
} from "@/features/notifications/foreground-notification-policy";

const organizationId = "507f1f77bcf86cd799439011";
const conversationId = "507f1f77bcf86cd799439012";
const now = new Date("2026-09-10T12:00:00.000Z").getTime();
const preferences = (
  overrides: Partial<NotificationPreferencesDto> = {},
): NotificationPreferencesDto => ({
  categories: {
    invitations: true,
    directMessages: true,
    mentionsAndReplies: true,
    reactions: true,
  },
  mutes: [],
  ...overrides,
});

describe("foreground notification policy", () => {
  it("fails closed without preferences and applies the direct-message category", () => {
    expect(
      shouldShowForegroundMessageBanner({
        conversationId,
        conversationType: ConversationType.DIRECT,
        organizationId,
        preferences: undefined,
        now,
      }),
    ).toBe(false);
    expect(
      shouldShowForegroundMessageBanner({
        conversationId,
        conversationType: ConversationType.DIRECT,
        organizationId,
        preferences: preferences({
          categories: {
            ...preferences().categories,
            directMessages: false,
          },
        }),
        now,
      }),
    ).toBe(false);
  });

  it("keeps ordinary channel banners enabled but honors scoped active mutes", () => {
    expect(
      shouldShowForegroundMessageBanner({
        conversationId,
        conversationType: ConversationType.CHANNEL,
        organizationId,
        preferences: preferences(),
        now,
      }),
    ).toBe(true);
    for (const muteConversationId of [null, conversationId]) {
      expect(
        shouldShowForegroundMessageBanner({
          conversationId,
          conversationType: ConversationType.CHANNEL,
          organizationId,
          preferences: preferences({
            mutes: [
              {
                organizationId,
                conversationId: muteConversationId,
                mutedUntil: null,
              },
            ],
          }),
          now,
        }),
      ).toBe(false);
    }
  });

  it("ignores expired mutes without waiting for a cache refresh", () => {
    expect(
      shouldShowForegroundMessageBanner({
        conversationId,
        conversationType: ConversationType.DIRECT,
        organizationId,
        preferences: preferences({
          mutes: [
            {
              organizationId,
              conversationId,
              mutedUntil: "2026-09-10T11:59:59.000Z",
            },
          ],
        }),
        now,
      }),
    ).toBe(true);
  });

  it("does not apply workspace mutes to new invitation interruptions", () => {
    expect(
      shouldShowForegroundPush(
        {
          type: NotificationType.ORGANIZATION_INVITATION_RECEIVED,
          organizationId,
        },
        preferences({
          mutes: [{ organizationId, conversationId: null, mutedUntil: null }],
        }),
        now,
      ),
    ).toBe(true);
  });

  it.each([
    [NotificationType.ORGANIZATION_INVITATION_ACCEPTED, "invitations"],
    [NotificationType.DIRECT_MESSAGE_RECEIVED, "directMessages"],
    [NotificationType.CHANNEL_MENTION_RECEIVED, "mentionsAndReplies"],
    [NotificationType.MESSAGE_REPLY_RECEIVED, "mentionsAndReplies"],
    [NotificationType.MESSAGE_REACTION_RECEIVED, "reactions"],
  ] as const)("applies the %s foreground category", (type, category) => {
    expect(
      shouldShowForegroundPush(
        { type, organizationId, conversationId },
        preferences({
          categories: { ...preferences().categories, [category]: false },
        }),
        now,
      ),
    ).toBe(false);
  });

  it("deduplicates Socket.IO and Expo interruptions for the same scope", () => {
    const deduper = createForegroundInterruptionDeduper(5_000);
    const scope = { organizationId, conversationId };
    expect(deduper.claim(scope, "SOCKET", now)).toBe(true);
    expect(deduper.claim(scope, "EXPO", now + 1_000)).toBe(false);
    expect(deduper.claim(scope, "SOCKET", now + 2_000)).toBe(true);
    expect(deduper.claim(scope, "EXPO", now + 7_000)).toBe(true);
  });
});
