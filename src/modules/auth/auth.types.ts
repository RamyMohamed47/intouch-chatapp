import type { PublicUser } from "../user/index.js";

export interface AccessTokenClaims {
  userId: string;
}

export interface PasswordHasher {
  hash(password: string): Promise<string>;
  compare(password: string, passwordHash: string): Promise<boolean>;
}

export interface AccessTokenManager {
  sign(userId: string): Promise<string>;
  verify(token: string): Promise<AccessTokenClaims>;
}

export interface RefreshTokenManager {
  create(sessionId?: string): { sessionId: string; token: string };
  parse(token: string): { sessionId: string } | null;
  hash(token: string): string;
}

export interface GoogleIdentity {
  providerAccountId: string;
  email: string;
  displayName: string;
  avatarUrl?: string;
}

export interface GoogleOAuthClient {
  getAuthorizationUrl(state: string): string;
  exchangeCode(code: string): Promise<GoogleIdentity>;
}

export interface OAuthStateManager {
  create(): string;
  verify(receivedState: string, expectedState: string): boolean;
}

export interface AuthResult {
  user: PublicUser;
  accessToken: string;
  refreshToken: string;
}

export interface RefreshResult {
  accessToken: string;
  refreshToken: string;
}

export interface GoogleAuthResult {
  refreshToken: string;
}

export interface AuthLocals {
  refreshToken?: string;
  userId?: string;
}

export interface AuthCookieConfig {
  name: string;
  secure: boolean;
  maxAgeMs: number;
}
