import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
} from "node:crypto";

import type { EncryptedMailPayload, MailPayload } from "./mail.types.js";

const deriveKey = (secret: string) =>
  createHash("sha256").update(secret, "utf8").digest();

export const createMailPayloadCipher = (secret: string) => {
  const key = deriveKey(secret);

  return {
    encrypt(payload: MailPayload): EncryptedMailPayload {
      const iv = randomBytes(12);
      const cipher = createCipheriv("aes-256-gcm", key, iv);
      const ciphertext = Buffer.concat([
        cipher.update(JSON.stringify(payload), "utf8"),
        cipher.final(),
      ]);

      return {
        ciphertext: ciphertext.toString("base64url"),
        iv: iv.toString("base64url"),
        authTag: cipher.getAuthTag().toString("base64url"),
      };
    },

    decrypt(payload: EncryptedMailPayload): MailPayload {
      const decipher = createDecipheriv(
        "aes-256-gcm",
        key,
        Buffer.from(payload.iv, "base64url"),
      );
      decipher.setAuthTag(Buffer.from(payload.authTag, "base64url"));
      const plaintext = Buffer.concat([
        decipher.update(Buffer.from(payload.ciphertext, "base64url")),
        decipher.final(),
      ]).toString("utf8");

      return JSON.parse(plaintext) as MailPayload;
    },
  };
};

export type MailPayloadCipher = ReturnType<typeof createMailPayloadCipher>;
