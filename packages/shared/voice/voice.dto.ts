import { z } from "zod";

import { dateTimeDtoSchema, identifierDtoSchema } from "../common/index.js";

export const CallStatus = {
  RINGING: "RINGING",
  CONNECTING: "CONNECTING",
  ACTIVE: "ACTIVE",
  ENDED: "ENDED",
} as const;

export const CallEndReason = {
  DECLINED: "DECLINED",
  CANCELLED: "CANCELLED",
  MISSED: "MISSED",
  COMPLETED: "COMPLETED",
  FAILED: "FAILED",
  ACCESS_REVOKED: "ACCESS_REVOKED",
} as const;

export const CallMediaMode = {
  AUDIO: "AUDIO",
  VIDEO: "VIDEO",
} as const;

export const VoiceSessionKind = {
  CALL: "CALL",
  VOICE_CHANNEL: "VOICE_CHANNEL",
} as const;

export const callStatusSchema = z.enum(CallStatus);
export const callEndReasonSchema = z.enum(CallEndReason);
export const callMediaModeSchema = z.enum(CallMediaMode);
export const voiceSessionKindSchema = z.enum(VoiceSessionKind);

export const callSummaryDtoSchema = z
  .object({
    id: identifierDtoSchema,
    callerUserId: identifierDtoSchema,
    recipientUserId: identifierDtoSchema,
    mediaMode: callMediaModeSchema,
    status: callStatusSchema,
    endReason: callEndReasonSchema.nullable(),
    startedAt: dateTimeDtoSchema,
    answeredAt: dateTimeDtoSchema.nullable(),
    endedAt: dateTimeDtoSchema.nullable(),
    durationSeconds: z.number().int().nonnegative().nullable(),
  })
  .strict();

export const callDtoSchema = callSummaryDtoSchema
  .extend({
    organizationId: identifierDtoSchema,
    conversationId: identifierDtoSchema,
  })
  .strict();

export const voiceOccupancyDtoSchema = z
  .object({
    conversationId: identifierDtoSchema,
    capacity: z.literal(10),
    participantUserIds: z.array(identifierDtoSchema).max(10),
    participants: z
      .array(
        z
          .object({
            userId: identifierDtoSchema,
            participantIdentity: z.string().uuid(),
          })
          .strict(),
      )
      .max(10),
  })
  .strict();

export const voiceCredentialsDtoSchema = z
  .object({
    serverUrl: z
      .string()
      .url()
      .refine((value) => value.startsWith("wss://"), {
        message: "Voice server URL must use wss://",
      }),
    token: z.string().min(1),
    expiresAt: dateTimeDtoSchema,
  })
  .strict();

const voiceSessionBase = {
  id: z.string().uuid(),
  organizationId: identifierDtoSchema,
  userId: identifierDtoSchema,
  connectedAt: dateTimeDtoSchema.nullable(),
};

export const voiceSessionDtoSchema = z.discriminatedUnion("kind", [
  z
    .object({
      ...voiceSessionBase,
      kind: z.literal(VoiceSessionKind.VOICE_CHANNEL),
      conversationId: identifierDtoSchema,
      callId: z.null(),
    })
    .strict(),
  z
    .object({
      ...voiceSessionBase,
      kind: z.literal(VoiceSessionKind.CALL),
      conversationId: identifierDtoSchema,
      callId: identifierDtoSchema,
    })
    .strict(),
]);

export const voiceJoinResponseSchema = z
  .object({
    session: voiceSessionDtoSchema,
    credentials: voiceCredentialsDtoSchema,
  })
  .strict();

export const activeVoiceSessionResponseSchema = z
  .object({ session: voiceSessionDtoSchema.nullable() })
  .strict();

export const callResponseSchema = z.object({ call: callDtoSchema }).strict();

export const callJoinResponseSchema = z
  .object({ call: callDtoSchema, credentials: voiceCredentialsDtoSchema })
  .strict();

export const callIncomingEventSchema = z
  .object({ call: callDtoSchema })
  .strict();

export const callUpdatedEventSchema = z
  .object({ call: callDtoSchema })
  .strict();

export const voiceOccupancyUpdatedEventSchema = voiceOccupancyDtoSchema;

export type CallStatusValue = z.infer<typeof callStatusSchema>;
export type CallEndReasonValue = z.infer<typeof callEndReasonSchema>;
export type CallMediaModeValue = z.infer<typeof callMediaModeSchema>;
export type VoiceSessionKindValue = z.infer<typeof voiceSessionKindSchema>;
export type CallSummaryDto = z.infer<typeof callSummaryDtoSchema>;
export type CallDto = z.infer<typeof callDtoSchema>;
export type VoiceOccupancyDto = z.infer<typeof voiceOccupancyDtoSchema>;
export type VoiceCredentialsDto = z.infer<typeof voiceCredentialsDtoSchema>;
export type VoiceSessionDto = z.infer<typeof voiceSessionDtoSchema>;
export type VoiceJoinResponse = z.infer<typeof voiceJoinResponseSchema>;
export type ActiveVoiceSessionResponse = z.infer<
  typeof activeVoiceSessionResponseSchema
>;
export type CallResponse = z.infer<typeof callResponseSchema>;
export type CallJoinResponse = z.infer<typeof callJoinResponseSchema>;
export type CallIncomingEvent = z.infer<typeof callIncomingEventSchema>;
export type CallUpdatedEvent = z.infer<typeof callUpdatedEventSchema>;
export type VoiceOccupancyUpdatedEvent = z.infer<
  typeof voiceOccupancyUpdatedEventSchema
>;
