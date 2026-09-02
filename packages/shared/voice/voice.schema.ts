import { z } from "zod";

import { identifierDtoSchema } from "../common/index.js";

export const joinVoiceSessionSchema = z
  .object({ replaceActiveSession: z.boolean().default(false) })
  .strict();

export const voiceSessionIdParamsSchema = z
  .object({ sessionId: z.string().uuid() })
  .strict();

export const callIdParamsSchema = z
  .object({ callId: identifierDtoSchema })
  .strict();

export const voiceParticipantParamsSchema = z
  .object({
    conversationId: identifierDtoSchema,
    userId: identifierDtoSchema,
  })
  .strict();

export const voiceHeartbeatSchema = z
  .object({ sessionId: z.string().uuid() })
  .strict();

export type JoinVoiceSessionInput = z.infer<typeof joinVoiceSessionSchema>;
export type CallIdParams = z.infer<typeof callIdParamsSchema>;
export type VoiceHeartbeatInput = z.infer<typeof voiceHeartbeatSchema>;
export type VoiceParticipantParams = z.infer<
  typeof voiceParticipantParamsSchema
>;
