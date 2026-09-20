import { z } from "zod";

export const MAX_UPLOAD_FILE_BYTES = 25 * 1024 * 1024;
export const MAX_SQUARE_IMAGE_UPLOAD_BYTES = 5 * 1024 * 1024;
export const MAX_VOICE_NOTE_BYTES = 5 * 1024 * 1024;
export const MIN_VOICE_NOTE_DURATION_MS = 1_000;
export const MAX_VOICE_NOTE_DURATION_MS = 5 * 60 * 1_000;
export const VOICE_NOTE_WAVEFORM_SAMPLES = 64;

const mongoIdSchema = z
  .string()
  .regex(/^[a-f\d]{24}$/i, "Must be a valid MongoDB ID");

export const UploadPurpose = {
  AVATAR: "AVATAR",
  MESSAGE_ATTACHMENT: "MESSAGE_ATTACHMENT",
  ORGANIZATION_LOGO: "ORGANIZATION_LOGO",
  VOICE_NOTE: "VOICE_NOTE",
} as const;

export const uploadPurposeSchema = z.enum(UploadPurpose);

export const uploadFileDescriptorSchema = z
  .object({
    fileName: z.string().trim().min(1).max(255),
    contentType: z.string().trim().min(1).max(127),
    size: z.number().int().positive().max(MAX_UPLOAD_FILE_BYTES),
  })
  .strict();

const squareImageFileDescriptorSchema = uploadFileDescriptorSchema.refine(
  ({ size }) => size <= MAX_SQUARE_IMAGE_UPLOAD_BYTES,
  "Image must not exceed 5 MB",
);

export const voiceNoteFileDescriptorSchema = uploadFileDescriptorSchema
  .extend({
    durationMs: z
      .number()
      .int()
      .min(MIN_VOICE_NOTE_DURATION_MS)
      .max(MAX_VOICE_NOTE_DURATION_MS),
    waveform: z
      .array(z.number().int().min(0).max(100))
      .length(VOICE_NOTE_WAVEFORM_SAMPLES),
  })
  .refine(({ size }) => size <= MAX_VOICE_NOTE_BYTES, {
    message: "Voice note must not exceed 5 MB",
  });

export const createUploadSchema = z.discriminatedUnion("purpose", [
  z
    .object({
      purpose: z.literal(UploadPurpose.AVATAR),
      files: z.tuple([squareImageFileDescriptorSchema]),
    })
    .strict(),
  z
    .object({
      purpose: z.literal(UploadPurpose.ORGANIZATION_LOGO),
      files: z.tuple([squareImageFileDescriptorSchema]),
    })
    .strict(),
  z
    .object({
      purpose: z.literal(UploadPurpose.MESSAGE_ATTACHMENT),
      conversationId: mongoIdSchema,
      files: z.array(uploadFileDescriptorSchema).min(1).max(5),
    })
    .strict(),
  z
    .object({
      purpose: z.literal(UploadPurpose.VOICE_NOTE),
      conversationId: mongoIdSchema,
      files: z.tuple([voiceNoteFileDescriptorSchema]),
    })
    .strict(),
]);

export const uploadParamsSchema = z
  .object({ uploadId: mongoIdSchema })
  .strict();

export const assetParamsSchema = z.object({ assetId: mongoIdSchema }).strict();

export const updateAvatarSchema = z
  .object({ uploadId: mongoIdSchema })
  .strict();

export type UploadPurposeValue = z.infer<typeof uploadPurposeSchema>;
export type UploadFileDescriptor = z.infer<typeof uploadFileDescriptorSchema>;
export type VoiceNoteFileDescriptor = z.infer<
  typeof voiceNoteFileDescriptorSchema
>;
export type CreateUploadInput = z.infer<typeof createUploadSchema>;
export type UploadParams = z.infer<typeof uploadParamsSchema>;
export type AssetParams = z.infer<typeof assetParamsSchema>;
export type UpdateAvatarInput = z.infer<typeof updateAvatarSchema>;
