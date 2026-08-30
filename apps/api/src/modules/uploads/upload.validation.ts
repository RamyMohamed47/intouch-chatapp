import path from "node:path";
import { fileTypeFromBuffer } from "file-type";
import {
  AttachmentKind,
  UploadPurpose,
  type AttachmentKindValue,
  type UploadPurposeValue,
} from "@intouch/shared/uploads";

import { UploadValidationError } from "./upload.errors.js";
import type { InspectedObject } from "./upload.types.js";

const allowedTypes = new Map<string, readonly string[]>([
  [".jpg", ["image/jpeg"]],
  [".jpeg", ["image/jpeg"]],
  [".png", ["image/png"]],
  [".webp", ["image/webp"]],
  [".gif", ["image/gif"]],
  [".pdf", ["application/pdf"]],
  [".txt", ["text/plain"]],
  [".csv", ["text/csv", "text/plain"]],
  [
    ".docx",
    ["application/vnd.openxmlformats-officedocument.wordprocessingml.document"],
  ],
  [
    ".xlsx",
    ["application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"],
  ],
  [
    ".pptx",
    [
      "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    ],
  ],
]);

const imageTypes = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
]);
const avatarTypes = new Set(["image/jpeg", "image/png", "image/webp"]);
const officeTypes = new Set([
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
]);

export const sanitizeFileName = (fileName: string) => {
  const normalized = path
    .basename(fileName.normalize("NFC"))
    .trim()
    .split("")
    .filter((character) => {
      const code = character.charCodeAt(0);
      return code > 0x1f && code !== 0x7f;
    })
    .join("");
  if (!normalized || normalized === "." || normalized === "..") {
    throw new UploadValidationError("File name is invalid");
  }
  return normalized.slice(0, 255);
};

export const validateDeclaredFile = (
  purpose: UploadPurposeValue,
  fileName: string,
  contentType: string,
  size: number,
) => {
  const extension = path.extname(fileName).toLowerCase();
  const allowedForExtension = allowedTypes.get(extension);
  if (!allowedForExtension?.includes(contentType)) {
    throw new UploadValidationError("File type is not supported");
  }
  if (
    purpose === UploadPurpose.AVATAR ||
    purpose === UploadPurpose.ORGANIZATION_LOGO
  ) {
    if (!avatarTypes.has(contentType)) {
      throw new UploadValidationError(
        "Image must be a JPEG, PNG, or WebP image",
      );
    }
    if (size > 5 * 1024 * 1024) {
      throw new UploadValidationError("Image must not exceed 5 MB", 413);
    }
  }
};

const hasZipSignature = (bytes: Uint8Array) =>
  bytes.length >= 4 &&
  bytes[0] === 0x50 &&
  bytes[1] === 0x4b &&
  [0x03, 0x05, 0x07].includes(bytes[2] ?? -1) &&
  [0x04, 0x06, 0x08].includes(bytes[3] ?? -1);

const isTextPrefix = (bytes: Uint8Array) => {
  if (bytes.includes(0)) return false;
  try {
    new TextDecoder("utf-8", { fatal: true }).decode(bytes);
    return true;
  } catch {
    return false;
  }
};

export const inspectUploadedFile = async (input: {
  purpose: UploadPurposeValue;
  fileName: string;
  declaredContentType: string;
  declaredSize: number;
  object: InspectedObject;
}): Promise<{
  contentType: string;
  size: number;
  kind: AttachmentKindValue;
}> => {
  if (
    input.object.contentType !== input.declaredContentType ||
    input.object.size !== input.declaredSize
  ) {
    throw new UploadValidationError(
      "Uploaded file metadata does not match the request",
    );
  }
  validateDeclaredFile(
    input.purpose,
    input.fileName,
    input.declaredContentType,
    input.declaredSize,
  );

  const detected = await fileTypeFromBuffer(input.object.prefix);
  const contentType = input.declaredContentType;
  if (contentType === "text/plain" || contentType === "text/csv") {
    if (detected || !isTextPrefix(input.object.prefix)) {
      throw new UploadValidationError("Text file contents are invalid");
    }
  } else if (officeTypes.has(contentType)) {
    if (!hasZipSignature(input.object.prefix)) {
      throw new UploadValidationError("Office document contents are invalid");
    }
    if (!detected || detected.mime !== contentType) {
      throw new UploadValidationError(
        "Office document contents do not match its type",
      );
    }
  } else if (!detected || detected.mime !== contentType) {
    throw new UploadValidationError(
      "File contents do not match its declared type",
    );
  }

  return {
    contentType,
    size: input.object.size,
    kind: imageTypes.has(contentType)
      ? AttachmentKind.IMAGE
      : AttachmentKind.FILE,
  };
};

export const contentDispositionFor = (
  fileName: string,
  kind: AttachmentKindValue,
) => {
  const fallback = fileName.replace(/[^A-Za-z0-9._-]/g, "_");
  const encoded = encodeURIComponent(fileName).replace(
    /[!'()*]/g,
    (value) => `%${value.charCodeAt(0).toString(16).toUpperCase()}`,
  );
  return `${kind === AttachmentKind.IMAGE ? "inline" : "attachment"}; filename="${fallback}"; filename*=UTF-8''${encoded}`;
};
