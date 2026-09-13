import { z } from "zod";

import { dateTimeDtoSchema, identifierDtoSchema } from "../common/index.js";
import { callMediaModeSchema } from "../voice/index.js";

export const PushPlatform = {
  ANDROID: "ANDROID",
  IOS: "IOS",
} as const;

export const pushPlatformSchema = z.enum(PushPlatform);

export const pushInstallationIdSchema = z.uuid();

export const expoPushTokenSchema = z
  .string()
  .trim()
  .min(20)
  .max(512)
  .regex(
    /^(?:ExponentPushToken|ExpoPushToken)\[[A-Za-z0-9_-]+\]$/,
    "A valid Expo push token is required",
  );

export const registerPushDeviceSchema = z
  .object({
    platform: pushPlatformSchema,
    expoPushToken: expoPushTokenSchema,
  })
  .strict();

export const pushDeviceDtoSchema = z
  .object({
    installationId: pushInstallationIdSchema,
    platform: pushPlatformSchema,
    enabled: z.boolean(),
    updatedAt: dateTimeDtoSchema,
  })
  .strict();

export const pushDeviceResponseSchema = z
  .object({ pushDevice: pushDeviceDtoSchema })
  .strict();

export const CallPushEventType = {
  INCOMING: "CALL_INCOMING",
  STATE_CHANGED: "CALL_STATE_CHANGED",
} as const;

export const callPushDataSchema = z.discriminatedUnion("type", [
  z
    .object({
      type: z.literal(CallPushEventType.INCOMING),
      callId: identifierDtoSchema,
      organizationId: identifierDtoSchema,
      conversationId: identifierDtoSchema,
      mediaMode: callMediaModeSchema,
      startedAt: dateTimeDtoSchema,
    })
    .strict(),
  z
    .object({
      type: z.literal(CallPushEventType.STATE_CHANGED),
      callId: identifierDtoSchema,
    })
    .strict(),
]);

export type PushPlatformValue = z.infer<typeof pushPlatformSchema>;
export type RegisterPushDeviceInput = z.infer<typeof registerPushDeviceSchema>;
export type PushDeviceDto = z.infer<typeof pushDeviceDtoSchema>;
export type PushDeviceResponse = z.infer<typeof pushDeviceResponseSchema>;
export type CallPushData = z.infer<typeof callPushDataSchema>;
