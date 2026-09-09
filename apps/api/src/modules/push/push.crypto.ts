import {
  createCipheriv,
  createDecipheriv,
  createHash,
  createHmac,
  randomBytes,
} from "node:crypto";

const deriveKey = (secret: string) =>
  createHash("sha256").update(secret, "utf8").digest();

export const createPushTokenCipher = (secret: string) => {
  const key = deriveKey(secret);

  return {
    hash(token: string) {
      return createHmac("sha256", key).update(token, "utf8").digest("hex");
    },
    encrypt(token: string) {
      const iv = randomBytes(12);
      const cipher = createCipheriv("aes-256-gcm", key, iv);
      const ciphertext = Buffer.concat([
        cipher.update(token, "utf8"),
        cipher.final(),
      ]);
      return {
        ciphertext: ciphertext.toString("base64url"),
        iv: iv.toString("base64url"),
        authTag: cipher.getAuthTag().toString("base64url"),
      };
    },
    decrypt(input: { ciphertext: string; iv: string; authTag: string }) {
      const decipher = createDecipheriv(
        "aes-256-gcm",
        key,
        Buffer.from(input.iv, "base64url"),
      );
      decipher.setAuthTag(Buffer.from(input.authTag, "base64url"));
      return Buffer.concat([
        decipher.update(Buffer.from(input.ciphertext, "base64url")),
        decipher.final(),
      ]).toString("utf8");
    },
  };
};

export type PushTokenCipher = ReturnType<typeof createPushTokenCipher>;
