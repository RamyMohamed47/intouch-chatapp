import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

export interface CreatedAuthActionToken {
  id: string;
  secretHash: string;
  token: string;
}

export const createAuthActionTokenManager = (secret: string) => {
  const hash = (value: string) =>
    createHmac("sha256", secret).update(value, "utf8").digest("hex");

  return {
    create(): CreatedAuthActionToken {
      const id = randomBytes(18).toString("base64url");
      const tokenSecret = randomBytes(32).toString("base64url");
      return {
        id,
        secretHash: hash(tokenSecret),
        token: `${id}.${tokenSecret}`,
      };
    },
    parse(token: string) {
      const [id, tokenSecret, extra] = token.split(".");
      if (!id || !tokenSecret || extra !== undefined) return null;
      return { id, secretHash: hash(tokenSecret) };
    },
    matches(leftHash: string, rightHash: string) {
      const left = Buffer.from(leftHash, "hex");
      const right = Buffer.from(rightHash, "hex");
      return left.length === right.length && timingSafeEqual(left, right);
    },
  };
};

export type AuthActionTokenManager = ReturnType<
  typeof createAuthActionTokenManager
>;
