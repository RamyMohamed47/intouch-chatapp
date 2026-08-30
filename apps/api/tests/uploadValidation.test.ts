import assert from "node:assert/strict";
import { describe, test } from "node:test";

import { UploadPurpose } from "@intouch/shared/uploads";

import { UploadValidationError } from "../src/modules/uploads/upload.errors.js";
import {
  contentDispositionFor,
  inspectUploadedFile,
  sanitizeFileName,
  validateDeclaredFile,
} from "../src/modules/uploads/upload.validation.js";

const png = Uint8Array.from(
  Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
    "base64",
  ),
);

describe("upload validation", () => {
  test("sanitizes names and rejects unsupported or unsafe declarations", () => {
    assert.equal(sanitizeFileName("../folder/report.pdf"), "report.pdf");
    assert.equal(sanitizeFileName("bad\u0000name.txt"), "badname.txt");
    assert.throws(
      () =>
        validateDeclaredFile(
          UploadPurpose.MESSAGE_ATTACHMENT,
          "archive.zip",
          "application/zip",
          100,
        ),
      UploadValidationError,
    );
    assert.throws(
      () =>
        validateDeclaredFile(
          UploadPurpose.MESSAGE_ATTACHMENT,
          "macro.docm",
          "application/vnd.ms-word.document.macroenabled.12",
          100,
        ),
      UploadValidationError,
    );
    assert.throws(
      () =>
        validateDeclaredFile(
          UploadPurpose.AVATAR,
          "animated.gif",
          "image/gif",
          100,
        ),
      UploadValidationError,
    );
  });

  test("accepts matching binary signatures and rejects metadata substitution", async () => {
    assert.deepEqual(
      await inspectUploadedFile({
        purpose: UploadPurpose.AVATAR,
        fileName: "avatar.png",
        declaredContentType: "image/png",
        declaredSize: png.length,
        object: {
          contentType: "image/png",
          size: png.length,
          etag: '"etag"',
          prefix: png,
        },
      }),
      { contentType: "image/png", size: png.length, kind: "IMAGE" },
    );
    await assert.rejects(
      inspectUploadedFile({
        purpose: UploadPurpose.AVATAR,
        fileName: "avatar.png",
        declaredContentType: "image/png",
        declaredSize: png.length,
        object: {
          contentType: "image/jpeg",
          size: png.length,
          etag: '"etag"',
          prefix: png,
        },
      }),
      UploadValidationError,
    );
  });

  test("requires complete UTF-8 text and exact OOXML detection", async () => {
    const validText = new TextEncoder().encode("name,value\nAlex,1\n");
    assert.equal(
      (
        await inspectUploadedFile({
          purpose: UploadPurpose.MESSAGE_ATTACHMENT,
          fileName: "report.csv",
          declaredContentType: "text/csv",
          declaredSize: validText.length,
          object: {
            contentType: "text/csv",
            size: validText.length,
            etag: '"etag"',
            prefix: validText,
          },
        })
      ).kind,
      "FILE",
    );
    const invalidText = Uint8Array.from([0x61, 0x00, 0x62]);
    await assert.rejects(
      inspectUploadedFile({
        purpose: UploadPurpose.MESSAGE_ATTACHMENT,
        fileName: "notes.txt",
        declaredContentType: "text/plain",
        declaredSize: invalidText.length,
        object: {
          contentType: "text/plain",
          size: invalidText.length,
          etag: '"etag"',
          prefix: invalidText,
        },
      }),
      UploadValidationError,
    );
    const genericZip = Uint8Array.from([
      0x50, 0x4b, 0x03, 0x04, 0x14, 0x00, 0x00, 0x00,
    ]);
    await assert.rejects(
      inspectUploadedFile({
        purpose: UploadPurpose.MESSAGE_ATTACHMENT,
        fileName: "renamed.docx",
        declaredContentType:
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        declaredSize: genericZip.length,
        object: {
          contentType:
            "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
          size: genericZip.length,
          etag: '"etag"',
          prefix: genericZip,
        },
      }),
      UploadValidationError,
    );
  });

  test("builds safe inline and download content dispositions", () => {
    assert.match(
      contentDispositionFor("resume's 2026.pdf", "FILE"),
      /^attachment; filename="resume_s_2026\.pdf"; filename\*=UTF-8''/,
    );
    assert.match(
      contentDispositionFor("avatar.png", "IMAGE"),
      /^inline; filename="avatar\.png";/,
    );
  });
});
