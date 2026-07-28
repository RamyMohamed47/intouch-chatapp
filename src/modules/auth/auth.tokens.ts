import { createHash, randomBytes, randomUUID } from "node:crypto";

import bcrypt from "bcryptjs";
import { jwtVerify, SignJWT } from "jose";

import UnauthorizedError from "../../errors/UnauthorizedError.js";
import type {
  AccessTokenManager,
  PasswordHasher,
  RefreshTokenManager,
} from "./auth.types.js";

const ACCESS_TOKEN_TTL = "15m";
const BCRYPT_COST = 12;

export interface AccessTokenConfig {
  secret: string;
  issuer: string;
  audience: string;
}

export const createBcryptPasswordHasher = (): PasswordHasher => ({
  hash(password) {
    return bcrypt.hash(password, BCRYPT_COST);
  },

  compare(password, passwordHash) {
    return bcrypt.compare(password, passwordHash);
  },
});

export const createJwtAccessTokenManager = ({
  secret,
  issuer,
  audience,
}: AccessTokenConfig): AccessTokenManager => {
  const key = new TextEncoder().encode(secret);

  return {
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

export const createRefreshTokenManager = (): RefreshTokenManager => ({
  create(sessionId = randomUUID()) {
    const secret = randomBytes(32).toString("base64url");

    return {
      sessionId,
      token: `${sessionId}.${secret}`,
    };
  },

  parse(token) {
    const [sessionId, secret, extra] = token.split(".");

    if (
      extra !== undefined ||
      !sessionId ||
      !secret ||
      !/^[0-9a-f-]{36}$/i.test(sessionId) ||
      !/^[A-Za-z0-9_-]{43}$/.test(secret)
    ) {
      return null;
    }

    return { sessionId };
  },

  hash(token) {
    return createHash("sha256").update(token).digest("hex");
  },
});
