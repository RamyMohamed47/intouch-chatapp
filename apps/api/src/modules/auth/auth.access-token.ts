import { randomUUID } from "node:crypto";

import { decodeJwt, jwtVerify, SignJWT } from "jose";

import UnauthorizedError from "../../errors/UnauthorizedError.js";
import type { AccessTokenManager } from "./auth.types.js";

const ACCESS_TOKEN_TTL = "15m";

export interface AccessTokenConfig {
  secret: string;
  issuer: string;
  audience: string;
}

export const createJwtAccessTokenManager = ({
  secret,
  issuer,
  audience,
}: AccessTokenConfig): AccessTokenManager => {
  const key = new TextEncoder().encode(secret);

  return {
    getExpiration(token) {
      return decodeJwt(token).exp ?? null;
    },

    sign(userId) {
      return new SignJWT({ type: "access" })
        .setProtectedHeader({ alg: "HS256" })
        .setSubject(userId)
        .setIssuer(issuer)
        .setAudience(audience)
        .setIssuedAt()
        .setExpirationTime(ACCESS_TOKEN_TTL)
        .setJti(randomUUID())
        .sign(key);
    },

    async verify(token) {
      try {
        const { payload } = await jwtVerify(token, key, {
          algorithms: ["HS256"],
          issuer,
          audience,
        });

        if (payload.type !== "access" || !payload.sub) {
          throw new UnauthorizedError("Invalid access token");
        }

        return { userId: payload.sub };
      } catch (error) {
        if (error instanceof UnauthorizedError) {
          throw error;
        }

        throw new UnauthorizedError("Invalid or expired access token");
      }
    },
  };
};
