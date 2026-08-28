import { z } from "zod";

import { dateTimeDtoSchema, identifierDtoSchema } from "../common/index.js";
import { ConversationType } from "../conversations/index.js";
import { publicUserSummaryDtoSchema } from "../users/index.js";

export const NotificationType = {
  ORGANIZATION_INVITATION_RECEIVED: "ORGANIZATION_INVITATION_RECEIVED",
  ORGANIZATION_INVITATION_ACCEPTED: "ORGANIZATION_INVITATION_ACCEPTED",
  DIRECT_MESSAGE_RECEIVED: "DIRECT_MESSAGE_RECEIVED",
  MESSAGE_REACTION_RECEIVED: "MESSAGE_REACTION_RECEIVED",
} as const;

export const notificationTypeSchema = z.enum(NotificationType);

const notificationOrganizationDtoSchema = z
  .object({
    id: identifierDtoSchema,
    name: z.string(),
    logoUrl: z.string().url().optional(),
  })
  .strict();

const notificationBase = {
  id: identifierDtoSchema,
  actor: publicUserSummaryDtoSchema,
  organization: notificationOrganizationDtoSchema,
  readAt: dateTimeDtoSchema.nullable(),
  createdAt: dateTimeDtoSchema,
  lastActivityAt: dateTimeDtoSchema,
};

export const organizationInvitationReceivedNotificationDtoSchema = z
  .object({
    ...notificationBase,
    type: z.literal(NotificationType.ORGANIZATION_INVITATION_RECEIVED),
    invitationId: identifierDtoSchema,
  })
  .strict();

export const organizationInvitationAcceptedNotificationDtoSchema = z
  .object({
    ...notificationBase,
    type: z.literal(NotificationType.ORGANIZATION_INVITATION_ACCEPTED),
  })
  .strict();

export const directMessageReceivedNotificationDtoSchema = z
  .object({
    ...notificationBase,
    type: z.literal(NotificationType.DIRECT_MESSAGE_RECEIVED),
    conversationId: identifierDtoSchema,
    latestMessageId: identifierDtoSchema,
    messageCount: z.number().int().positive(),
  })
  .strict();

export const messageReactionReceivedNotificationDtoSchema = z
  .object({
    ...notificationBase,
    type: z.literal(NotificationType.MESSAGE_REACTION_RECEIVED),
    conversationId: identifierDtoSchema,
    conversationType: z.enum(ConversationType),
    messageId: identifierDtoSchema,
    emoji: z.string().min(1),
  })
  .strict();

export const notificationDtoSchema = z.discriminatedUnion("type", [
  organizationInvitationReceivedNotificationDtoSchema,
  organizationInvitationAcceptedNotificationDtoSchema,
  directMessageReceivedNotificationDtoSchema,
  messageReactionReceivedNotificationDtoSchema,
]);

export const notificationResponseSchema = z
  .object({ notification: notificationDtoSchema })
  .strict();

export const notificationListResponseSchema = z
  .object({
    notifications: z.array(notificationDtoSchema),
    nextCursor: z.string().nullable(),
    unreadCount: z.number().int().nonnegative(),
  })
  .strict();

export const NotificationChangeKind = {
  UPSERTED: "UPSERTED",
  DELETED: "DELETED",
  READ_ALL: "READ_ALL",
} as const;

export const notificationChangedEventSchema = z.discriminatedUnion("kind", [
  z
    .object({
      kind: z.literal(NotificationChangeKind.UPSERTED),
      notification: notificationDtoSchema,
    })
    .strict(),
  z
    .object({
      kind: z.literal(NotificationChangeKind.DELETED),
      notificationId: identifierDtoSchema,
    })
    .strict(),
  z.object({ kind: z.literal(NotificationChangeKind.READ_ALL) }).strict(),
]);

export type NotificationTypeValue = z.infer<typeof notificationTypeSchema>;
export type NotificationDto = z.infer<typeof notificationDtoSchema>;
export type NotificationResponse = z.infer<typeof notificationResponseSchema>;
export type NotificationListResponse = z.infer<
  typeof notificationListResponseSchema
>;
export type NotificationChangedEvent = z.infer<
  typeof notificationChangedEventSchema
>;
