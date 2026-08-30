import type { Types } from "mongoose";

export enum AuthProvider {
  PASSWORD = "PASSWORD",
  GOOGLE = "GOOGLE",
  GITHUB = "GITHUB",
}

export enum EmailVerificationStatus {
  PENDING = "PENDING",
  VERIFIED = "VERIFIED",
}

export interface LoginProvider {
  provider: AuthProvider;
  providerAccountId: string;
  passwordHash?: string;
  linkedAt: Date;
  lastUsedAt?: Date;
  metadata?: Record<string, unknown>;
}

export interface User {
  username: string;
  displayName: string;
  email: string;
  avatarUrl?: string;
  avatarAssetId?: Types.ObjectId;
  lastSeenAt?: Date;
  emailVerificationStatus?: EmailVerificationStatus;
  emailVerifiedAt?: Date;
  loginProviders: LoginProvider[];
  createdAt: Date;
  updatedAt: Date;
}

export interface PublicUser {
  id: string;
  username: string;
  displayName: string;
  email: string;
  avatarUrl?: string;
  avatarAssetId?: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface PasswordUser {
  user: PublicUser;
  passwordHash: string;
  emailVerificationStatus: EmailVerificationStatus;
}

export interface AuthAccount {
  user: PublicUser;
  hasPassword: boolean;
  emailVerificationStatus: EmailVerificationStatus;
}
