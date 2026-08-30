import {
  NotificationChangeKind,
  NotificationStatus,
  NotificationType,
  notificationDtoSchema,
  type NotificationDto,
  type NotificationListQuery,
} from "@intouch/shared/notifications";
import type { Logger } from "pino";

import type { OrganizationRepository } from "../organizations/organization.repository.js";
import type { UserRepository } from "../user/user.repository.js";
import {
  NotificationCursorError,
  NotificationNotFoundError,
} from "./notification.errors.js";
import type { NotificationRealtime } from "./notification.realtime.js";
import type { NotificationRepository } from "./notification.repository.js";
import type {
  NotificationCursor,
  NotificationPage,
  NotificationRecord,
} from "./notification.types.js";

interface CursorPayload {
  lastActivityAt: string;
  id: string;
}

const encodeCursor = (record: NotificationRecord) =>
  Buffer.from(
    JSON.stringify({
      lastActivityAt: record.lastActivityAt.toISOString(),
      id: record.id,
    } satisfies CursorPayload),
  ).toString("base64url");

const decodeCursor = (value?: string): NotificationCursor | null => {
  if (!value) return null;
  try {
    const parsed = JSON.parse(
      Buffer.from(value, "base64url").toString("utf8"),
    ) as unknown;
    if (
      typeof parsed !== "object" ||
      parsed === null ||
      !("lastActivityAt" in parsed) ||
      !("id" in parsed) ||
      typeof parsed.lastActivityAt !== "string" ||
      typeof parsed.id !== "string" ||
      !/^[a-f\d]{24}$/i.test(parsed.id)
    ) {
      throw new NotificationCursorError();
    }
    const lastActivityAt = new Date(parsed.lastActivityAt);
    if (Number.isNaN(lastActivityAt.getTime())) {
      throw new NotificationCursorError();
    }
    return { lastActivityAt, id: parsed.id };
  } catch (error) {
    if (error instanceof NotificationCursorError) throw error;
    throw new NotificationCursorError();
  }
};

export interface NotificationServiceDependencies {
  logger: Pick<Logger, "error">;
  notifications: NotificationRepository;
  organizations: Pick<OrganizationRepository, "findByIds">;
  realtime: NotificationRealtime;
  users: Pick<UserRepository, "findPublicByIds">;
  now?: () => Date;
}

const createNotificationService = ({
  logger,
  notifications,
  organizations,
  realtime,
  users,
  now = () => new Date(),
}: NotificationServiceDependencies) => {
  const hydrate = async (
    records: readonly NotificationRecord[],
  ): Promise<NotificationDto[]> => {
    const [actors, organizationRecords] = await Promise.all([
      users.findPublicByIds([
        ...new Set(records.map(({ actorUserId }) => actorUserId)),
      ]),
      organizations.findByIds([
        ...new Set(records.map(({ organizationId }) => organizationId)),
      ]),
    ]);
    const actorsById = new Map(actors.map((actor) => [actor.id, actor]));
    const organizationsById = new Map(
      organizationRecords.map((organization) => [
        organization.id,
        organization,
      ]),
    );

    return records.flatMap((record) => {
      const actor = actorsById.get(record.actorUserId);
      const organization = organizationsById.get(record.organizationId);
      if (!actor || !organization) return [];
      const common = {
        id: record.id,
        actor: {
          id: actor.id,
          username: actor.username,
          displayName: actor.displayName,
          avatarAssetId: actor.avatarAssetId ?? null,
          ...(actor.avatarUrl ? { avatarUrl: actor.avatarUrl } : {}),
        },
        organization: {
          id: organization.id,
          name: organization.name,
          ...(organization.logoUrl ? { logoUrl: organization.logoUrl } : {}),
        },
        readAt: record.readAt,
        createdAt: record.createdAt,
        lastActivityAt: record.lastActivityAt,
      };

      switch (record.type) {
        case NotificationType.ORGANIZATION_INVITATION_RECEIVED:
          return record.invitationId
            ? [
                notificationDtoSchema.parse({
                  ...common,
                  type: record.type,
                  invitationId: record.invitationId,
                }),
              ]
            : [];
        case NotificationType.ORGANIZATION_INVITATION_ACCEPTED:
          return [
            notificationDtoSchema.parse({ ...common, type: record.type }),
          ];
        case NotificationType.DIRECT_MESSAGE_RECEIVED:
          return record.conversationId &&
            record.latestMessageId &&
            record.messageCount
            ? [
                notificationDtoSchema.parse({
                  ...common,
                  type: record.type,
                  conversationId: record.conversationId,
                  latestMessageId: record.latestMessageId,
                  messageCount: record.messageCount,
                }),
              ]
            : [];
        case NotificationType.MESSAGE_REACTION_RECEIVED:
          return record.conversationId &&
            record.conversationType &&
            record.messageId &&
            record.emoji
            ? [
                notificationDtoSchema.parse({
                  ...common,
                  type: record.type,
                  conversationId: record.conversationId,
                  conversationType: record.conversationType,
                  messageId: record.messageId,
                  emoji: record.emoji,
                }),
              ]
            : [];
      }
    });
  };

  const publishUpsert = async (record: NotificationRecord) => {
    try {
      const [notification] = await hydrate([record]);
      if (!notification) return;
      realtime.notificationChanged(record.recipientUserId, {
        kind: NotificationChangeKind.UPSERTED,
        notification,
      });
    } catch (error) {
      logger.error(
        { err: error, notificationId: record.id },
        "Notification realtime delivery failed",
      );
    }
  };

  const publishDeleted = (record: NotificationRecord) => {
    try {
      realtime.notificationChanged(record.recipientUserId, {
        kind: NotificationChangeKind.DELETED,
        notificationId: record.id,
      });
    } catch (error) {
      logger.error(
        { err: error, notificationId: record.id },
        "Notification realtime delivery failed",
      );
    }
  };

  return {
    hydrate,
    publishUpsert,
    publishDeleted,

    async list(
      userId: string,
      query: NotificationListQuery,
    ): Promise<NotificationPage> {
      const currentTime = now();
      const records = await notifications.listForUser(
        userId,
        query.status ?? NotificationStatus.ALL,
        decodeCursor(query.cursor),
        query.limit + 1,
        currentTime,
      );
      const hasMore = records.length > query.limit;
      const pageRecords = hasMore ? records.slice(0, query.limit) : records;
      const [views, unreadCount] = await Promise.all([
        hydrate(pageRecords),
        notifications.countUnread(userId, currentTime),
      ]);
      return {
        notifications: views,
        nextCursor: hasMore
          ? encodeCursor(pageRecords.at(-1) as NotificationRecord)
          : null,
        unreadCount,
      };
    },

    async markRead(userId: string, notificationId: string) {
      const record = await notifications.markRead(
        notificationId,
        userId,
        now(),
      );
      if (!record) throw new NotificationNotFoundError();
      const [view] = await hydrate([record]);
      if (!view) throw new NotificationNotFoundError();
      await publishUpsert(record);
      return view;
    },

    async markAllRead(userId: string) {
      await notifications.markAllRead(userId, now());
      try {
        realtime.notificationChanged(userId, {
          kind: NotificationChangeKind.READ_ALL,
        });
      } catch (error) {
        logger.error(
          { err: error, userId },
          "Notification realtime delivery failed",
        );
      }
    },
  };
};

export type NotificationService = ReturnType<typeof createNotificationService>;
export default createNotificationService;
