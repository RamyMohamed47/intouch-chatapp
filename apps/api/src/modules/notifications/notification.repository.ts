import type { ClientSession, FilterQuery } from "mongoose";
import { Types } from "mongoose";

import {
  NotificationStatus,
  NotificationType,
  type NotificationStatusValue,
} from "@intouch/shared/notifications";

import NotificationModel, {
  type NotificationDocument,
} from "./notification.model.js";
import type {
  CreateNotificationInput,
  NotificationCursor,
  NotificationRecord,
  UpsertDirectMessageNotificationInput,
  UpsertReactionNotificationInput,
} from "./notification.types.js";

type LeanNotification = NotificationDocument & { _id: Types.ObjectId };

const toRecord = (notification: LeanNotification): NotificationRecord => ({
  id: notification._id.toString(),
  recipientUserId: notification.recipientUserId.toString(),
  actorUserId: notification.actorUserId.toString(),
  organizationId: notification.organizationId.toString(),
  type: notification.type,
  ...(notification.invitationId
    ? { invitationId: notification.invitationId.toString() }
    : {}),
  ...(notification.conversationId
    ? { conversationId: notification.conversationId.toString() }
    : {}),
  ...(notification.conversationType
    ? { conversationType: notification.conversationType }
    : {}),
  ...(notification.messageId
    ? { messageId: notification.messageId.toString() }
    : {}),
  ...(notification.latestMessageId
    ? { latestMessageId: notification.latestMessageId.toString() }
    : {}),
  ...(notification.messageCount
    ? { messageCount: notification.messageCount }
    : {}),
  ...(notification.emoji ? { emoji: notification.emoji } : {}),
  readAt: notification.readAt ?? null,
  lastActivityAt: notification.lastActivityAt,
  expiresAt: notification.expiresAt,
  createdAt: notification.createdAt,
  updatedAt: notification.updatedAt,
});

const withSession = <T extends { session(session: ClientSession): T }>(
  query: T,
  session?: ClientSession,
) => (session ? query.session(session) : query);

export interface NotificationRepository {
  create(input: CreateNotificationInput): Promise<NotificationRecord>;
  upsertDirectMessage(
    input: UpsertDirectMessageNotificationInput,
  ): Promise<NotificationRecord>;
  upsertReaction(
    input: UpsertReactionNotificationInput,
  ): Promise<NotificationRecord>;
  listForUser(
    userId: string,
    status: NotificationStatusValue,
    cursor: NotificationCursor | null,
    limit: number,
    now: Date,
  ): Promise<NotificationRecord[]>;
  countUnread(userId: string, now: Date): Promise<number>;
  markRead(
    notificationId: string,
    userId: string,
    readAt: Date,
  ): Promise<NotificationRecord | null>;
  markAllRead(userId: string, readAt: Date): Promise<number>;
  markDirectMessageReadThrough(
    userId: string,
    conversationId: string,
    messageId: string,
    readAt: Date,
  ): Promise<NotificationRecord | null>;
  deleteReaction(
    messageId: string,
    actorUserId: string,
  ): Promise<NotificationRecord | null>;
  deleteByInvitationId(invitationId: string): Promise<NotificationRecord[]>;
  deleteByMessageId(messageId: string): Promise<NotificationRecord[]>;
  deleteByConversationId(conversationId: string): Promise<NotificationRecord[]>;
  deleteByConversationAndRecipient(
    conversationId: string,
    recipientUserId: string,
  ): Promise<NotificationRecord[]>;
  deleteByConversationAndActor(
    conversationId: string,
    actorUserId: string,
  ): Promise<NotificationRecord[]>;
  deleteByOrganizationId(organizationId: string): Promise<NotificationRecord[]>;
}

const createMongooseNotificationRepository = (
  session?: ClientSession,
): NotificationRepository => {
  const deleteManyReturning = async (
    filter: FilterQuery<NotificationDocument>,
  ) => {
    const findQuery = NotificationModel.find(filter).lean<LeanNotification[]>();
    const records = (await withSession(findQuery, session).exec()).map(
      toRecord,
    );
    if (records.length === 0) return [];
    await withSession(NotificationModel.deleteMany(filter), session).exec();
    return records;
  };

  return {
    async create(input) {
      const query = NotificationModel.findOneAndUpdate(
        { recipientUserId: input.recipientUserId, dedupeKey: input.dedupeKey },
        {
          $setOnInsert: {
            ...input,
            readAt: null,
          },
        },
        { upsert: true, new: true },
      ).lean<LeanNotification>();
      const notification = await withSession(query, session).exec();
      if (!notification)
        throw new Error("Notification creation returned no document");
      return toRecord(notification);
    },

    async upsertDirectMessage(input) {
      const activeGroupKey = `direct:${input.conversationId}`;
      const query = NotificationModel.findOneAndUpdate(
        {
          recipientUserId: input.recipientUserId,
          activeGroupKey,
          readAt: null,
        },
        {
          $setOnInsert: {
            recipientUserId: input.recipientUserId,
            organizationId: input.organizationId,
            conversationId: input.conversationId,
            type: NotificationType.DIRECT_MESSAGE_RECEIVED,
            activeGroupKey,
          },
          $set: {
            actorUserId: input.actorUserId,
            latestMessageId: input.latestMessageId,
            lastActivityAt: input.lastActivityAt,
            expiresAt: input.expiresAt,
          },
          $inc: { messageCount: 1 },
        },
        { upsert: true, new: true },
      ).lean<LeanNotification>();
      const notification = await withSession(query, session).exec();
      if (!notification)
        throw new Error("DM notification upsert returned no document");
      return toRecord(notification);
    },

    async upsertReaction(input) {
      const dedupeKey = `reaction:${input.messageId}:${input.actorUserId}`;
      const query = NotificationModel.findOneAndUpdate(
        { recipientUserId: input.recipientUserId, dedupeKey },
        {
          $setOnInsert: {
            recipientUserId: input.recipientUserId,
            organizationId: input.organizationId,
            conversationId: input.conversationId,
            conversationType: input.conversationType,
            messageId: input.messageId,
            type: NotificationType.MESSAGE_REACTION_RECEIVED,
            dedupeKey,
          },
          $set: {
            actorUserId: input.actorUserId,
            emoji: input.emoji,
            readAt: null,
            lastActivityAt: input.lastActivityAt,
            expiresAt: input.expiresAt,
          },
        },
        { upsert: true, new: true },
      ).lean<LeanNotification>();
      const notification = await withSession(query, session).exec();
      if (!notification)
        throw new Error("Reaction notification upsert returned no document");
      return toRecord(notification);
    },

    async listForUser(userId, status, cursor, limit, now) {
      const cursorFilter = cursor
        ? {
            $or: [
              { lastActivityAt: { $lt: cursor.lastActivityAt } },
              {
                lastActivityAt: cursor.lastActivityAt,
                _id: { $lt: new Types.ObjectId(cursor.id) },
              },
            ],
          }
        : {};
      const query = NotificationModel.find({
        recipientUserId: userId,
        expiresAt: { $gt: now },
        ...(status === NotificationStatus.UNREAD ? { readAt: null } : {}),
        ...cursorFilter,
      })
        .sort({ lastActivityAt: -1, _id: -1 })
        .limit(limit)
        .lean<LeanNotification[]>();
      return (await withSession(query, session).exec()).map(toRecord);
    },

    async countUnread(userId, now) {
      const query = NotificationModel.countDocuments({
        recipientUserId: userId,
        readAt: null,
        expiresAt: { $gt: now },
      });
      return withSession(query, session).exec();
    },

    async markRead(notificationId, userId, readAt) {
      const query = NotificationModel.findOneAndUpdate(
        { _id: notificationId, recipientUserId: userId },
        { $set: { readAt }, $unset: { activeGroupKey: "" } },
        { new: true },
      ).lean<LeanNotification>();
      const notification = await withSession(query, session).exec();
      return notification ? toRecord(notification) : null;
    },

    async markAllRead(userId, readAt) {
      const query = NotificationModel.updateMany(
        { recipientUserId: userId, readAt: null },
        { $set: { readAt }, $unset: { activeGroupKey: "" } },
      );
      return (await withSession(query, session).exec()).modifiedCount;
    },

    async markDirectMessageReadThrough(
      userId,
      conversationId,
      messageId,
      readAt,
    ) {
      const query = NotificationModel.findOneAndUpdate(
        {
          recipientUserId: userId,
          conversationId,
          type: NotificationType.DIRECT_MESSAGE_RECEIVED,
          readAt: null,
          latestMessageId: { $lte: new Types.ObjectId(messageId) },
        },
        { $set: { readAt }, $unset: { activeGroupKey: "" } },
        { new: true },
      ).lean<LeanNotification>();
      const notification = await withSession(query, session).exec();
      return notification ? toRecord(notification) : null;
    },

    async deleteReaction(messageId, actorUserId) {
      const query = NotificationModel.findOneAndDelete({
        messageId,
        actorUserId,
        type: NotificationType.MESSAGE_REACTION_RECEIVED,
      }).lean<LeanNotification>();
      const notification = await withSession(query, session).exec();
      return notification ? toRecord(notification) : null;
    },

    deleteByInvitationId(invitationId) {
      return deleteManyReturning({ invitationId });
    },
    deleteByMessageId(messageId) {
      return deleteManyReturning({ messageId });
    },
    deleteByConversationId(conversationId) {
      return deleteManyReturning({ conversationId });
    },
    deleteByConversationAndRecipient(conversationId, recipientUserId) {
      return deleteManyReturning({ conversationId, recipientUserId });
    },
    deleteByConversationAndActor(conversationId, actorUserId) {
      return deleteManyReturning({ conversationId, actorUserId });
    },
    deleteByOrganizationId(organizationId) {
      return deleteManyReturning({ organizationId });
    },
  };
};

export default createMongooseNotificationRepository;
