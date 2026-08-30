import assert from "node:assert/strict";
import { describe, test } from "node:test";

import {
  AttachmentKind,
  UploadPurpose,
  attachmentDtoSchema,
  completeUploadResponseSchema,
  createUploadSchema,
} from "../uploads/index.js";

const conversationId = "507f1f77bcf86cd799439011";
const uploadId = "507f1f77bcf86cd799439012";

describe("shared upload contracts", () => {
  test("accepts strict avatar, organization logo, and message uploads", () => {
    assert.deepEqual(
      createUploadSchema.parse({
        purpose: UploadPurpose.AVATAR,
        files: [
          { fileName: " avatar.webp ", contentType: "image/webp", size: 512 },
        ],
      }),
      {
        purpose: UploadPurpose.AVATAR,
        files: [
          { fileName: "avatar.webp", contentType: "image/webp", size: 512 },
        ],
      },
    );
    assert.equal(
      createUploadSchema.safeParse({
        purpose: UploadPurpose.ORGANIZATION_LOGO,
        files: [
          {
            fileName: "organization.webp",
            contentType: "image/webp",
            size: 512,
          },
        ],
      }).success,
      true,
    );
    assert.equal(
      createUploadSchema.safeParse({
        purpose: UploadPurpose.MESSAGE_ATTACHMENT,
        conversationId,
        files: [
          { fileName: "report.pdf", contentType: "application/pdf", size: 1 },
        ],
      }).success,
      true,
    );
  });

  test("enforces purpose-specific counts, size limits, IDs, and strictness", () => {
    const file = { fileName: "image.png", contentType: "image/png", size: 1 };
    assert.equal(
      createUploadSchema.safeParse({
        purpose: UploadPurpose.ORGANIZATION_LOGO,
        files: [file, file],
      }).success,
      false,
    );
    assert.equal(
      createUploadSchema.safeParse({
        purpose: UploadPurpose.ORGANIZATION_LOGO,
        files: [{ ...file, size: 5 * 1024 * 1024 + 1 }],
      }).success,
      false,
    );
    assert.equal(
      createUploadSchema.safeParse({
        purpose: UploadPurpose.AVATAR,
        files: [file, file],
      }).success,
      false,
    );
    assert.equal(
      createUploadSchema.safeParse({
        purpose: UploadPurpose.MESSAGE_ATTACHMENT,
        conversationId,
        files: Array.from({ length: 6 }, () => file),
      }).success,
      false,
    );
    assert.equal(
      createUploadSchema.safeParse({
        purpose: UploadPurpose.MESSAGE_ATTACHMENT,
        conversationId: "invalid",
        files: [file],
      }).success,
      false,
    );
    assert.equal(
      createUploadSchema.safeParse({
        purpose: UploadPurpose.MESSAGE_ATTACHMENT,
        conversationId,
        files: [{ ...file, size: 25 * 1024 * 1024 + 1 }],
      }).success,
      false,
    );
    assert.equal(
      createUploadSchema.safeParse({
        purpose: UploadPurpose.AVATAR,
        files: [file],
        extra: true,
      }).success,
      false,
    );
  });

  test("parses safe attachment metadata without storage internals", () => {
    const attachment = {
      id: uploadId,
      fileName: "report.pdf",
      contentType: "application/pdf",
      size: 1024,
      kind: AttachmentKind.FILE,
      createdAt: "2026-08-30T00:00:00.000Z",
    };
    assert.deepEqual(attachmentDtoSchema.parse(attachment), attachment);
    assert.equal(
      attachmentDtoSchema.safeParse({ ...attachment, objectKey: "private/key" })
        .success,
      false,
    );
    assert.deepEqual(
      completeUploadResponseSchema.parse({
        upload: { ...attachment, uploadId },
      }).upload,
      { ...attachment, uploadId },
    );
  });
});
