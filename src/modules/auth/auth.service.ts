import type { LoginInput, RegisterInput } from "@intouch/shared/auth";

import type { UserRepository } from "../user/index.js";
import {
  DuplicateIdentityError,
  InvalidCredentialsError,
  InvalidRefreshTokenError,
} from "./auth.errors.js";
import type { AuthSessionRepository } from "./auth.repository.js";
import type {
  AccessTokenManager,
  AuthResult,
  PasswordHasher,
  RefreshResult,
  RefreshTokenManager,
} from "./auth.types.js";

const REFRESH_TOKEN_TTL_MS = 30 * 24 * 60 * 60 * 1000;

export interface AuthServiceDependencies {
  users: UserRepository;
  sessions: AuthSessionRepository;
  passwords: PasswordHasher;
  accessTokens: AccessTokenManager;
  refreshTokens: RefreshTokenManager;
  now?: () => Date;
}

const isDuplicateKeyError = (error: unknown) =>
  typeof error === "object" &&
  error !== null &&
  "code" in error &&
  error.code === 11000;

const createAuthService = ({
  users,
  sessions,
  passwords,
  accessTokens,
  refreshTokens,
  now = () => new Date(),
}: AuthServiceDependencies) => {
  const issueAuthentication = async (
    user: AuthResult["user"],
  ): Promise<AuthResult> => {
    const createdAt = now();
    const refreshToken = refreshTokens.create();

    await sessions.create({
      id: refreshToken.sessionId,
      userId: user.id,
      tokenHash: refreshTokens.hash(refreshToken.token),
      expiresAt: new Date(createdAt.getTime() + REFRESH_TOKEN_TTL_MS),
    });

    return {
      user,
      accessToken: await accessTokens.sign(user.id),
      refreshToken: refreshToken.token,
    };
  };

  return {
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
        if (isDuplicateKeyError(error)) {
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
