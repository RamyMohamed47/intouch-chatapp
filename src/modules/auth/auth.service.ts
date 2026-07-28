import type { LoginInput, RegisterInput } from "@intouch/shared/auth";
import { randomBytes } from "node:crypto";

import {
  UserIdentityConflictError,
  type UserRepository,
} from "../user/index.js";
import {
  DuplicateIdentityError,
  GoogleIdentityConflictError,
  InvalidCredentialsError,
  InvalidRefreshTokenError,
} from "./auth.errors.js";
import type { AuthSessionRepository } from "./auth.repository.js";
import type {
  AccessTokenManager,
  AuthResult,
  GoogleAuthResult,
  GoogleIdentity,
  GoogleOAuthClient,
  PasswordHasher,
  RefreshResult,
  RefreshTokenManager,
} from "./auth.types.js";

const REFRESH_TOKEN_TTL_MS = 30 * 24 * 60 * 60 * 1000;
const MAX_USERNAME_ATTEMPTS = 5;

export interface AuthServiceDependencies {
  users: UserRepository;
  sessions: AuthSessionRepository;
  passwords: PasswordHasher;
  accessTokens: AccessTokenManager;
  googleOAuth: GoogleOAuthClient;
  refreshTokens: RefreshTokenManager;
  now?: () => Date;
  usernameSuffix?: () => string;
}

const createAuthService = ({
  users,
  sessions,
  passwords,
  accessTokens,
  googleOAuth,
  refreshTokens,
  now = () => new Date(),
  usernameSuffix = () => randomBytes(4).toString("hex"),
}: AuthServiceDependencies) => {
  const issueRefreshSession = async (user: AuthResult["user"]) => {
    const createdAt = now();
    const refreshToken = refreshTokens.create();

    await sessions.create({
      id: refreshToken.sessionId,
      userId: user.id,
      tokenHash: refreshTokens.hash(refreshToken.token),
      expiresAt: new Date(createdAt.getTime() + REFRESH_TOKEN_TTL_MS),
    });

    return refreshToken.token;
  };

  const issueAuthentication = async (
    user: AuthResult["user"],
  ): Promise<AuthResult> => ({
    user,
    accessToken: await accessTokens.sign(user.id),
    refreshToken: await issueRefreshSession(user),
  });

  const getUsernameBase = (email: string) => {
    const localPart = email.split("@")[0] ?? "user";
    const normalized = localPart
      .toLowerCase()
      .replace(/[^a-z0-9_]+/g, "_")
      .replace(/^_+|_+$/g, "")
      .replace(/_+/g, "_");
    const base = normalized.length >= 3 ? normalized : `user_${normalized}`;

    return (base || "user").slice(0, 30);
  };

  const getUsernameCandidate = (email: string, attempt: number) => {
    const base = getUsernameBase(email);

    if (attempt === 0) {
      return base;
    }

    const suffix = usernameSuffix()
      .toLowerCase()
      .replace(/[^a-z0-9]/g, "")
      .slice(0, 8);
    const safeSuffix = suffix || randomBytes(4).toString("hex");

    return `${base.slice(0, 29 - safeSuffix.length)}_${safeSuffix}`;
  };

  const linkGoogleIdentity = async (
    user: AuthResult["user"],
    identity: GoogleIdentity,
    usedAt: Date,
  ) => {
    try {
      const linkedUser = await users.linkGoogleProvider(
        user.id,
        identity.providerAccountId,
        usedAt,
      );

      if (linkedUser) {
        return linkedUser;
      }
    } catch (error) {
      if (!(error instanceof UserIdentityConflictError)) {
        throw error;
      }
    }

    const providerUser = await users.useGoogleProvider(
      identity.providerAccountId,
      usedAt,
    );

    if (providerUser?.id === user.id) {
      return providerUser;
    }

    throw new GoogleIdentityConflictError();
  };

  const resolveGoogleUser = async (identity: GoogleIdentity) => {
    const usedAt = now();
    const providerUser = await users.useGoogleProvider(
      identity.providerAccountId,
      usedAt,
    );

    if (providerUser) {
      return providerUser;
    }

    const emailUser = await users.findPublicByEmail(identity.email);

    if (emailUser) {
      return linkGoogleIdentity(emailUser, identity, usedAt);
    }

    for (let attempt = 0; attempt < MAX_USERNAME_ATTEMPTS; attempt += 1) {
      const username = getUsernameCandidate(identity.email, attempt);

      if (await users.usernameExists(username)) {
        continue;
      }

      try {
        return await users.createGoogleUser({
          username,
          displayName: identity.displayName,
          email: identity.email,
          ...(identity.avatarUrl ? { avatarUrl: identity.avatarUrl } : {}),
          providerAccountId: identity.providerAccountId,
          usedAt,
        });
      } catch (error) {
        if (!(error instanceof UserIdentityConflictError)) {
          throw error;
        }

        const racedProviderUser = await users.useGoogleProvider(
          identity.providerAccountId,
          usedAt,
        );

        if (racedProviderUser) {
          return racedProviderUser;
        }

        const racedEmailUser = await users.findPublicByEmail(identity.email);

        if (racedEmailUser) {
          return linkGoogleIdentity(racedEmailUser, identity, usedAt);
        }
      }
    }

    throw new GoogleIdentityConflictError();
  };

  return {
    getGoogleAuthorizationUrl(state: string) {
      return googleOAuth.getAuthorizationUrl(state);
    },

    async loginWithGoogle(code: string): Promise<GoogleAuthResult> {
      const identity = await googleOAuth.exchangeCode(code);
      const user = await resolveGoogleUser(identity);

      return { refreshToken: await issueRefreshSession(user) };
    },

    async register(input: RegisterInput): Promise<AuthResult> {
      if (await users.hasIdentityConflict(input.email, input.username)) {
        throw new DuplicateIdentityError();
      }

      const passwordHash = await passwords.hash(input.password);

      try {
        const user = await users.createPasswordUser({
          username: input.username,
          displayName: input.displayName,
          email: input.email,
          passwordHash,
        });

        return issueAuthentication(user);
      } catch (error) {
        if (error instanceof UserIdentityConflictError) {
          throw new DuplicateIdentityError();
        }

        throw error;
      }
    },

    async login(input: LoginInput): Promise<AuthResult> {
      const passwordUser = await users.findPasswordUserByEmail(input.email);

      if (
        !passwordUser ||
        !(await passwords.compare(input.password, passwordUser.passwordHash))
      ) {
        throw new InvalidCredentialsError();
      }

      await users.touchPasswordProvider(passwordUser.user.id, now());

      return issueAuthentication(passwordUser.user);
    },

    async refresh(token: string): Promise<RefreshResult> {
      const parsedToken = refreshTokens.parse(token);

      if (!parsedToken) {
        throw new InvalidRefreshTokenError();
      }

      const nextRefreshToken = refreshTokens.create(parsedToken.sessionId);
      const userId = await sessions.rotate({
        id: parsedToken.sessionId,
        currentTokenHash: refreshTokens.hash(token),
        nextTokenHash: refreshTokens.hash(nextRefreshToken.token),
        now: now(),
      });

      if (!userId) {
        await sessions.deleteById(parsedToken.sessionId);
        throw new InvalidRefreshTokenError();
      }

      const user = await users.findPublicById(userId);

      if (!user) {
        await sessions.deleteById(parsedToken.sessionId);
        throw new InvalidRefreshTokenError();
      }

      return {
        accessToken: await accessTokens.sign(user.id),
        refreshToken: nextRefreshToken.token,
      };
    },

    async getCurrentUser(userId: string) {
      const user = await users.findPublicById(userId);

      if (!user) {
        throw new InvalidCredentialsError();
      }

      return user;
    },
  };
};

export type AuthService = ReturnType<typeof createAuthService>;

export default createAuthService;
