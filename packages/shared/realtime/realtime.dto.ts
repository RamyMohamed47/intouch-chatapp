import { z } from "zod";

import { errorDtoSchema } from "../common/index.js";
import { presenceStatusSchema } from "../memberships/index.js";
import { messageDtoSchema, readReceiptDtoSchema } from "../messages/index.js";
import { conversationSocketSchema } from "./realtime.schema.js";

export const socketHandshakeAuthSchema = z
  .object({ accessToken: z.string().min(1) })
  .strict();

export const socketAcknowledgementSchema = z.discriminatedUnion("success", [
  z.object({ success: z.literal(true) }),
  z.object({ success: z.literal(false), error: errorDtoSchema }),
]);

export const presenceEventSchema = z.object({
  userId: z.string().min(1),
  status: presenceStatusSchema,
  lastSeenAt: z
    .union([z.date(), z.string().datetime({ offset: true })])
    .transform((value) =>
      value instanceof Date
        ? value.toISOString()
        : new Date(value).toISOString(),
    )
    .nullable(),
});

export const typingEventSchema = z.object({
  conversationId: z.string().min(1),
  userId: z.string().min(1),
  isTyping: z.boolean(),
});

export const conversationAccessRevokedEventSchema = conversationSocketSchema;
export const messageEventSchema = messageDtoSchema;
export const readReceiptEventSchema = readReceiptDtoSchema;

export type SocketHandshakeAuth = z.infer<typeof socketHandshakeAuthSchema>;
export type SocketAcknowledgementResult = z.infer<
  typeof socketAcknowledgementSchema
>;
export type PresenceEvent = z.infer<typeof presenceEventSchema>;
export type TypingEvent = z.infer<typeof typingEventSchema>;
export type ConversationAccessRevokedEvent = z.infer<
  typeof conversationAccessRevokedEventSchema
>;
export type MessageEvent = z.infer<typeof messageEventSchema>;
export type ReadReceiptEvent = z.infer<typeof readReceiptEventSchema>;
