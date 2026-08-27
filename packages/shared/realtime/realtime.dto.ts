import { z } from "zod";

import { errorDtoSchema } from "../common/index.js";
import { PresenceStatus } from "../memberships/index.js";
import { messageDtoSchema, readReceiptDtoSchema } from "../messages/index.js";
import { ConversationType } from "../conversations/index.js";
import {
  conversationSocketSchema,
  organizationSocketSchema,
  socketIdentifierSchema,
} from "./realtime.schema.js";

export const socketHandshakeAuthSchema = z
  .object({ accessToken: z.string().min(1) })
  .strict();

export const socketAcknowledgementSchema = z.discriminatedUnion("success", [
  z.object({ success: z.literal(true) }),
  z.object({ success: z.literal(false), error: errorDtoSchema }),
]);

export const socketConnectionErrorSchema = errorDtoSchema
  .extend({ retryAfterMs: z.number().int().positive().optional() })
  .strict();

const presenceLastSeenSchema = z
  .union([z.date(), z.string().datetime({ offset: true })])
  .transform((value) =>
    value instanceof Date ? value.toISOString() : new Date(value).toISOString(),
  );

export const presenceEventSchema = z.discriminatedUnion("status", [
  z
    .object({
      userId: socketIdentifierSchema,
      status: z.literal(PresenceStatus.ONLINE),
      lastSeenAt: z.null(),
    })
    .strict(),
  z
    .object({
      userId: socketIdentifierSchema,
      status: z.literal(PresenceStatus.OFFLINE),
      lastSeenAt: presenceLastSeenSchema.nullable(),
    })
    .strict(),
]);

export const typingEventSchema = z.object({
  conversationId: z.string().min(1),
  userId: z.string().min(1),
  isTyping: z.boolean(),
});

export const membershipJoinedEventSchema = organizationSocketSchema.extend({
  userId: socketIdentifierSchema,
});

export const conversationAccessRevokedEventSchema = conversationSocketSchema;
export const messageEventSchema = messageDtoSchema;
export const readReceiptEventSchema = readReceiptDtoSchema;

export const ConversationActivityKind = {
  CONVERSATION_CREATED: "CONVERSATION_CREATED",
  MESSAGE_CREATED: "MESSAGE_CREATED",
  MESSAGE_UPDATED: "MESSAGE_UPDATED",
  MESSAGE_DELETED: "MESSAGE_DELETED",
} as const;

export const conversationActivityKindSchema = z.enum(ConversationActivityKind);

export const conversationActivityEventSchema = z
  .object({
    organizationId: socketIdentifierSchema,
    conversationId: socketIdentifierSchema,
    conversationType: z.enum(ConversationType),
    actorUserId: socketIdentifierSchema,
    activityId: z.string().uuid(),
    kind: conversationActivityKindSchema,
  })
  .strict();

export const channelReadReceiptsChangedEventSchema = conversationSocketSchema;

export type SocketHandshakeAuth = z.infer<typeof socketHandshakeAuthSchema>;
export type SocketAcknowledgementResult = z.infer<
  typeof socketAcknowledgementSchema
>;
export type SocketConnectionError = z.infer<typeof socketConnectionErrorSchema>;
export type PresenceEvent = z.infer<typeof presenceEventSchema>;
export type TypingEvent = z.infer<typeof typingEventSchema>;
export type MembershipJoinedEvent = z.infer<typeof membershipJoinedEventSchema>;
export type ConversationAccessRevokedEvent = z.infer<
  typeof conversationAccessRevokedEventSchema
>;
export type MessageEvent = z.infer<typeof messageEventSchema>;
export type ReadReceiptEvent = z.infer<typeof readReceiptEventSchema>;
export type ConversationActivityKindValue = z.infer<
  typeof conversationActivityKindSchema
>;
export type ConversationActivityEvent = z.infer<
  typeof conversationActivityEventSchema
>;
export type ChannelReadReceiptsChangedEvent = z.infer<
  typeof channelReadReceiptsChangedEventSchema
>;
