import { z } from "zod";

export const MAX_UPLOAD_FILE_BYTES = 25 * 1024 * 1024;
export const MAX_SQUARE_IMAGE_UPLOAD_BYTES = 5 * 1024 * 1024;

const mongoIdSchema = z
  .string()
  .regex(/^[a-f\d]{24}$/i, "Must be a valid MongoDB ID");

export const UploadPurpose = {
  AVATAR: "AVATAR",
  MESSAGE_ATTACHMENT: "MESSAGE_ATTACHMENT",
  ORGANIZATION_LOGO: "ORGANIZATION_LOGO",
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
export type CreateUploadInput = z.infer<typeof createUploadSchema>;
export type UploadParams = z.infer<typeof uploadParamsSchema>;
export type AssetParams = z.infer<typeof assetParamsSchema>;
export type UpdateAvatarInput = z.infer<typeof updateAvatarSchema>;
