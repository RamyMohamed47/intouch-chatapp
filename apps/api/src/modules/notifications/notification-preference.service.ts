import type {
  NotificationCategoryPreferences,
  NotificationPreferencesDto,
} from "@intouch/shared/notifications";

import ValidationError from "../../errors/ValidationError.js";
import type { ConversationService } from "../conversations/conversation.service.js";
import type { MembershipService } from "../memberships/index.js";
import { OrganizationNotFoundError } from "../organizations/organization.errors.js";
import type { NotificationPreferenceRepository } from "./notification-preference.repository.js";

export interface NotificationPreferenceServiceDependencies {
  conversations: Pick<ConversationService, "getAccessible">;
  memberships: Pick<MembershipService, "findForUser">;
  preferences: NotificationPreferenceRepository;
  now?: () => Date;
}

const createNotificationPreferenceService = ({
  conversations,
  memberships,
  preferences,
  now = () => new Date(),
}: NotificationPreferenceServiceDependencies) => {
  const get = async (userId: string): Promise<NotificationPreferencesDto> => ({
    categories: await preferences.getCategories(userId),
    mutes: await preferences.listMutes(userId, now()),
  });

  const parseMutedUntil = (mutedUntil: string | null) => {
    const value = mutedUntil ? new Date(mutedUntil) : null;
    if (value && value <= now()) {
      throw new ValidationError("Mute expiry must be in the future");
    }
    return value;
  };

  return {
    get,

    async update(userId: string, categories: NotificationCategoryPreferences) {
      await preferences.updateCategories(userId, categories);
      return get(userId);
    },

    async muteOrganization(
      userId: string,
      organizationId: string,
      mutedUntil: string | null,
    ) {
      const value = parseMutedUntil(mutedUntil);
      if (!(await memberships.findForUser(userId, organizationId))) {
        throw new OrganizationNotFoundError();
      }
      await preferences.upsertMute({
        userId,
        organizationId,
        mutedUntil: value,
      });
      return get(userId);
    },

    async unmuteOrganization(userId: string, organizationId: string) {
      await preferences.deleteMute({ userId, organizationId });
      return get(userId);
    },

    async muteConversation(
      userId: string,
      conversationId: string,
      mutedUntil: string | null,
    ) {
      const value = parseMutedUntil(mutedUntil);
      const conversation = await conversations.getAccessible(
        userId,
        conversationId,
      );
      await preferences.upsertMute({
        userId,
        organizationId: conversation.organizationId,
        conversationId,
        mutedUntil: value,
      });
      return get(userId);
    },

    async unmuteConversation(userId: string, conversationId: string) {
      await preferences.deleteMute({ userId, conversationId });
      return get(userId);
    },
  };
};

export type NotificationPreferenceService = ReturnType<
  typeof createNotificationPreferenceService
>;
export default createNotificationPreferenceService;
