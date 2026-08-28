import type {
  ForgotPasswordInput,
  LoginInput,
  RegisterInput,
  ResendVerificationInput,
  ResetPasswordInput,
  VerifyEmailInput,
} from "@intouch/shared/auth";
import { randomBytes } from "node:crypto";

import {
  EmailVerificationStatus,
  UserIdentityConflictError,
  type AuthUserRepository,
} from "../user/index.js";
import type { MailOutboxJobFactory } from "../mail/index.js";
import { AuthActionPurpose } from "./auth.action-token.model.js";
import type { AuthActionTokenManager } from "./auth.action-token.js";
import {
  DuplicateIdentityError,
  EmailVerificationRequiredError,
  GoogleIdentityConflictError,
  InvalidCredentialsError,
  InvalidOrExpiredAuthTokenError,
  InvalidRefreshTokenError,
} from "./auth.errors.js";
import type { AuthSessionRepository } from "./auth.repository.js";
import type { AuthUnitOfWork } from "./auth.unit-of-work.js";
import type { LoginProtectionService } from "./auth.login-protection.js";
import type { AuthMailProtectionService } from "./auth.mail-protection.js";
import type {
  AccessTokenManager,
  AuthResult,
  GoogleAuthResult,
  GoogleIdentity,
  GoogleOAuthClient,
  PasswordHasher,
  RefreshResult,
  RefreshTokenManager,
  RegistrationPendingResult,
} from "./auth.types.js";

const REFRESH_TOKEN_TTL_MS = 30 * 24 * 60 * 60 * 1000;
const MAX_USERNAME_ATTEMPTS = 5;
const EMAIL_VERIFICATION_TTL_MS = 24 * 60 * 60 * 1000;
const PASSWORD_RESET_TTL_MS = 15 * 60 * 1000;

export interface AuthServiceDependencies {
  users: AuthUserRepository;
  sessions: AuthSessionRepository;
  passwords: PasswordHasher;
  accessTokens: AccessTokenManager;
  googleOAuth: GoogleOAuthClient;
  loginProtection: LoginProtectionService;
  refreshTokens: RefreshTokenManager;
  unitOfWork: AuthUnitOfWork;
  actionTokens: AuthActionTokenManager;
  mail: MailOutboxJobFactory;
  mailProtection: AuthMailProtectionService;
  now?: () => Date;
  usernameSuffix?: () => string;
}

const createAuthService = ({
  users,
  sessions,
  passwords,
  accessTokens,
  googleOAuth,
  loginProtection,
  refreshTokens,
  unitOfWork,
  actionTokens,
  mail,
  mailProtection,
  now = () => new Date(),
  usernameSuffix = () => randomBytes(4).toString("hex"),
}: AuthServiceDependencies) => {
  const issueRefreshSession = async (
    user: AuthResult["user"],
    sessionRepository: AuthSessionRepository,
  ) => {
    const createdAt = now();
    const refreshToken = refreshTokens.create();

    await sessionRepository.create({
      id: refreshToken.sessionId,
      userId: user.id,
      tokenHash: refreshTokens.hash(refreshToken.token),
      expiresAt: new Date(createdAt.getTime() + REFRESH_TOKEN_TTL_MS),
    });

    return refreshToken.token;
  };

  const issueAuthentication = async (
    user: AuthResult["user"],
    sessionRepository: AuthSessionRepository,
  ): Promise<AuthResult> => ({
    user,
    accessToken: await accessTokens.sign(user.id),
    refreshToken: await issueRefreshSession(user, sessionRepository),
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
    userRepository: AuthUserRepository,
    user: AuthResult["user"],
    identity: GoogleIdentity,
    usedAt: Date,
  ) => {
    try {
      const linkedUser = await userRepository.linkGoogleProvider(
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

    const providerUser = await userRepository.useGoogleProvider(
      identity.providerAccountId,
      usedAt,
    );

    if (providerUser?.id === user.id) {
      return providerUser;
    }

    throw new GoogleIdentityConflictError();
  };

  const resolveGoogleUser = async (
    userRepository: AuthUserRepository,
    identity: GoogleIdentity,
  ) => {
    const usedAt = now();
    const providerUser = await userRepository.useGoogleProvider(
      identity.providerAccountId,
      usedAt,
    );

    if (providerUser) {
      return providerUser;
    }

    const emailUser = await userRepository.findPublicByEmail(identity.email);

    if (emailUser) {
      return linkGoogleIdentity(userRepository, emailUser, identity, usedAt);
    }

    for (let attempt = 0; attempt < MAX_USERNAME_ATTEMPTS; attempt += 1) {
      const username = getUsernameCandidate(identity.email, attempt);

      if (await userRepository.usernameExists(username)) {
        continue;
      }

      try {
        return await userRepository.createGoogleUser({
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

        const racedProviderUser = await userRepository.useGoogleProvider(
          identity.providerAccountId,
          usedAt,
        );

        if (racedProviderUser) {
          return racedProviderUser;
        }

        const racedEmailUser = await userRepository.findPublicByEmail(
          identity.email,
        );

        if (racedEmailUser) {
          return linkGoogleIdentity(
            userRepository,
            racedEmailUser,
            identity,
            usedAt,
          );
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
      await loginProtection.clearAttempts(identity.email);

      return unitOfWork.run(async (context) => {
        const user = await resolveGoogleUser(context.users, identity);
        await context.users.markEmailVerified(user.id, now());
        return {
          refreshToken: await issueRefreshSession(user, context.sessions),
        };
      });
    },

    async register(input: RegisterInput): Promise<RegistrationPendingResult> {
      const passwordHash = await passwords.hash(input.password);

      try {
        return await unitOfWork.run(async (context) => {
          if (
            await context.users.hasIdentityConflict(input.email, input.username)
          ) {
            throw new DuplicateIdentityError();
          }
          const user = await context.users.createPasswordUser({
            username: input.username,
            displayName: input.displayName,
            email: input.email,
            passwordHash,
          });
          const issuedAt = now();
          const expiresAt = new Date(
            issuedAt.getTime() + EMAIL_VERIFICATION_TTL_MS,
          );
          const actionToken = actionTokens.create();
          await context.actionTokens.replace({
            id: actionToken.id,
            userId: user.id,
            purpose: AuthActionPurpose.VERIFY_EMAIL,
            secretHash: actionToken.secretHash,
            expiresAt,
          });
          await context.mailOutbox.enqueue(
            mail.verification({
              userId: user.id,
              email: user.email,
              displayName: user.displayName,
              token: actionToken.token,
              expiresAt,
            }),
          );

          return { email: user.email, verificationRequired: true as const };
        });
      } catch (error) {
        if (error instanceof UserIdentityConflictError) {
          throw new DuplicateIdentityError();
        }

        throw error;
      }
    },

    async login(input: LoginInput): Promise<AuthResult> {
      await loginProtection.reserveAttempt(input.email);
      const passwordUser = await users.findPasswordUserByEmail(input.email);
      const passwordMatches = passwordUser
        ? await passwords.compare(input.password, passwordUser.passwordHash)
        : await passwords.compareDummy(input.password);

      if (!passwordUser || !passwordMatches) {
        throw new InvalidCredentialsError();
      }

      if (
        passwordUser.emailVerificationStatus === EmailVerificationStatus.PENDING
      ) {
        await loginProtection.clearAttempts(input.email);
        throw new EmailVerificationRequiredError();
      }

      await loginProtection.clearAttempts(input.email);

      return unitOfWork.run(async (context) => {
        await context.users.touchPasswordProvider(passwordUser.user.id, now());
        return issueAuthentication(passwordUser.user, context.sessions);
      });
    },

    async verifyEmail(input: VerifyEmailInput): Promise<void> {
      const parsedToken = actionTokens.parse(input.token);
      if (!parsedToken) throw new InvalidOrExpiredAuthTokenError();

      await unitOfWork.run(async (context) => {
        const userId = await context.actionTokens.consume({
          ...parsedToken,
          purpose: AuthActionPurpose.VERIFY_EMAIL,
          now: now(),
        });
        if (!userId) throw new InvalidOrExpiredAuthTokenError();
        if (!(await context.users.markEmailVerified(userId, now()))) {
          throw new InvalidOrExpiredAuthTokenError();
        }
        await context.mailOutbox.cancel(`auth-verification:${userId}`);
      });
    },

    async resendVerification(input: ResendVerificationInput): Promise<void> {
      await mailProtection.reserve(input.email, "VERIFICATION");
      const account = await users.findAuthAccountByEmail(input.email);
      if (
        !account?.hasPassword ||
        account.emailVerificationStatus === EmailVerificationStatus.VERIFIED
      ) {
        return;
      }

      const issuedAt = now();
      const expiresAt = new Date(
        issuedAt.getTime() + EMAIL_VERIFICATION_TTL_MS,
      );
      const actionToken = actionTokens.create();
      await unitOfWork.run(async (context) => {
        await context.actionTokens.replace({
          id: actionToken.id,
          userId: account.user.id,
          purpose: AuthActionPurpose.VERIFY_EMAIL,
          secretHash: actionToken.secretHash,
          expiresAt,
        });
        await context.mailOutbox.enqueue(
          mail.verification({
            userId: account.user.id,
            email: account.user.email,
            displayName: account.user.displayName,
            token: actionToken.token,
            expiresAt,
          }),
        );
      });
    },

    async forgotPassword(input: ForgotPasswordInput): Promise<void> {
      await mailProtection.reserve(input.email, "PASSWORD_RESET");
      const account = await users.findAuthAccountByEmail(input.email);
      if (!account?.hasPassword) return;

      const issuedAt = now();
      const expiresAt = new Date(issuedAt.getTime() + PASSWORD_RESET_TTL_MS);
      const actionToken = actionTokens.create();
      await unitOfWork.run(async (context) => {
        await context.actionTokens.replace({
          id: actionToken.id,
          userId: account.user.id,
          purpose: AuthActionPurpose.RESET_PASSWORD,
          secretHash: actionToken.secretHash,
          expiresAt,
        });
        await context.mailOutbox.enqueue(
          mail.passwordReset({
            userId: account.user.id,
            email: account.user.email,
            displayName: account.user.displayName,
            token: actionToken.token,
            expiresAt,
          }),
        );
      });
    },

    async resetPassword(input: ResetPasswordInput): Promise<void> {
      const parsedToken = actionTokens.parse(input.token);
      if (!parsedToken) throw new InvalidOrExpiredAuthTokenError();
      const passwordHash = await passwords.hash(input.password);
      const resetAt = now();

      const email = await unitOfWork.run(async (context) => {
        const userId = await context.actionTokens.consume({
          ...parsedToken,
          purpose: AuthActionPurpose.RESET_PASSWORD,
          now: resetAt,
        });
        if (!userId) throw new InvalidOrExpiredAuthTokenError();
        const updated = await context.users.updatePasswordAndVerify(
          userId,
          passwordHash,
          resetAt,
        );
        if (!updated) throw new InvalidOrExpiredAuthTokenError();

        await context.sessions.deleteByUserId(userId);
        await context.actionTokens.deleteForUser(
          userId,
          AuthActionPurpose.VERIFY_EMAIL,
        );
        await context.mailOutbox.cancel(`auth-reset:${userId}`);
        await context.mailOutbox.cancel(`auth-verification:${userId}`);
        return updated.email;
      });

      await loginProtection.clearAttempts(email);
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

    async logout(token: string | undefined): Promise<void> {
      if (!token) return;

      const parsedToken = refreshTokens.parse(token);
      if (!parsedToken) return;

      await sessions.deleteById(parsedToken.sessionId);
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
