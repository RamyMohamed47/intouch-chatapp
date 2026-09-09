import type {
  NotificationCategoryPreferences,
  NotificationMuteDto,
  NotificationTypeValue,
} from "@intouch/shared/notifications";
import { NotificationType } from "@intouch/shared/notifications";

import { NotificationMuteModel } from "./notification-mute.model.js";
import { NotificationPreferenceModel } from "./notification-preference.model.js";

export const DEFAULT_NOTIFICATION_CATEGORIES: NotificationCategoryPreferences =
  {
    invitations: true,
    directMessages: true,
    mentionsAndReplies: true,
    reactions: true,
  };

const categoryFor = (
  type: NotificationTypeValue,
): keyof NotificationCategoryPreferences => {
  switch (type) {
    case NotificationType.ORGANIZATION_INVITATION_RECEIVED:
    case NotificationType.ORGANIZATION_INVITATION_ACCEPTED:
      return "invitations";
    case NotificationType.DIRECT_MESSAGE_RECEIVED:
      return "directMessages";
    case NotificationType.CHANNEL_MENTION_RECEIVED:
    case NotificationType.MESSAGE_REPLY_RECEIVED:
      return "mentionsAndReplies";
    case NotificationType.MESSAGE_REACTION_RECEIVED:
      return "reactions";
  }
};

export interface NotificationPreferenceRepository {
  getCategories(userId: string): Promise<NotificationCategoryPreferences>;
  updateCategories(
    userId: string,
    categories: NotificationCategoryPreferences,
  ): Promise<NotificationCategoryPreferences>;
  listMutes(userId: string, now: Date): Promise<NotificationMuteDto[]>;
  upsertMute(input: {
    userId: string;
    organizationId: string;
    conversationId?: string;
    mutedUntil: Date | null;
  }): Promise<void>;
  deleteMute(input: {
    userId: string;
    organizationId?: string;
    conversationId?: string;
  }): Promise<void>;
  allowsPush(input: {
    userId: string;
    type: NotificationTypeValue;
    organizationId: string;
    conversationId?: string;
    now: Date;
  }): Promise<boolean>;
}

const createMongooseNotificationPreferenceRepository =
  (): NotificationPreferenceRepository => ({
    async getCategories(userId) {
      const record = await NotificationPreferenceModel.findOne({ userId })
        .lean()
        .exec();
      return record?.categories ?? { ...DEFAULT_NOTIFICATION_CATEGORIES };
    },

    async updateCategories(userId, categories) {
      const record = await NotificationPreferenceModel.findOneAndUpdate(
        { userId },
        { $set: { categories } },
        { upsert: true, new: true, runValidators: true },
      )
        .lean()
        .exec();
      return record?.categories ?? categories;
    },

    async listMutes(userId, now) {
      const records = await NotificationMuteModel.find({
        userId,
        $or: [{ mutedUntil: { $exists: false } }, { mutedUntil: { $gt: now } }],
      })
        .sort({ organizationId: 1, conversationId: 1 })
        .lean()
        .exec();
      return records.map((record) => ({
        organizationId: record.organizationId.toString(),
        conversationId: record.conversationId?.toString() ?? null,
        mutedUntil: record.mutedUntil?.toISOString() ?? null,
      }));
    },

    async upsertMute(input) {
      await NotificationMuteModel.updateOne(
        {
          userId: input.userId,
          organizationId: input.organizationId,
          ...(input.conversationId
            ? { conversationId: input.conversationId }
            : { conversationId: { $exists: false } }),
        },
        {
          $set: {
            userId: input.userId,
            organizationId: input.organizationId,
            ...(input.conversationId
              ? { conversationId: input.conversationId }
              : {}),
            ...(input.mutedUntil ? { mutedUntil: input.mutedUntil } : {}),
          },
          ...(input.mutedUntil ? {} : { $unset: { mutedUntil: 1 } }),
        },
        { upsert: true, runValidators: true },
      ).exec();
    },

    async deleteMute(input) {
      await NotificationMuteModel.deleteOne({
        userId: input.userId,
        ...(input.conversationId
          ? { conversationId: input.conversationId }
          : {
              organizationId: input.organizationId,
              conversationId: { $exists: false },
            }),
      }).exec();
    },

    async allowsPush(input) {
      const categories = await this.getCategories(input.userId);
      if (!categories[categoryFor(input.type)]) return false;
      if (input.type === NotificationType.ORGANIZATION_INVITATION_RECEIVED) {
        return true;
      }
      const mute = await NotificationMuteModel.exists({
        userId: input.userId,
        organizationId: input.organizationId,
        $or: [
          { conversationId: { $exists: false } },
          ...(input.conversationId
            ? [{ conversationId: input.conversationId }]
            : []),
        ],
        $and: [
          {
            $or: [
              { mutedUntil: { $exists: false } },
              { mutedUntil: { $gt: input.now } },
            ],
          },
        ],
      }).exec();
      return mute === null;
    },
  });

export default createMongooseNotificationPreferenceRepository;
