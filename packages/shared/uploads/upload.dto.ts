import { z } from "zod";

import { dateTimeDtoSchema, identifierDtoSchema } from "../common/index.js";

export const AttachmentKind = {
  IMAGE: "IMAGE",
  FILE: "FILE",
} as const;

export const attachmentKindSchema = z.enum(AttachmentKind);

export const attachmentDtoSchema = z
  .object({
    id: identifierDtoSchema,
    fileName: z.string().min(1),
    contentType: z.string().min(1),
    size: z.number().int().positive(),
    kind: attachmentKindSchema,
    createdAt: dateTimeDtoSchema,
  })
  .strict();

export const uploadTicketDtoSchema = z
  .object({
    uploadId: identifierDtoSchema,
    uploadUrl: z.string().url(),
    headers: z.record(z.string(), z.string()),
    expiresAt: dateTimeDtoSchema,
  })
  .strict();

export const createUploadResponseSchema = z
  .object({ uploadTickets: z.array(uploadTicketDtoSchema).min(1).max(5) })
  .strict();

export const completedUploadDtoSchema = attachmentDtoSchema.extend({
  uploadId: identifierDtoSchema,
});

export const completeUploadResponseSchema = z
  .object({ upload: completedUploadDtoSchema })
  .strict();

export const assetAccessResponseSchema = z
  .object({
    accessUrl: z.string().url(),
    expiresAt: dateTimeDtoSchema,
  })
  .strict();

export type AttachmentKindValue = z.infer<typeof attachmentKindSchema>;
export type AttachmentDto = z.infer<typeof attachmentDtoSchema>;
export type UploadTicketDto = z.infer<typeof uploadTicketDtoSchema>;
export type CreateUploadResponse = z.infer<typeof createUploadResponseSchema>;
export type CompletedUploadDto = z.infer<typeof completedUploadDtoSchema>;
export type CompleteUploadResponse = z.infer<
  typeof completeUploadResponseSchema
>;
export type AssetAccessResponse = z.infer<typeof assetAccessResponseSchema>;
