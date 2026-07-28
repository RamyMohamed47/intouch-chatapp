export enum AuthProvider {
  PASSWORD = "PASSWORD",
  GOOGLE = "GOOGLE",
  GITHUB = "GITHUB",
}

export enum UserStatus {
  ONLINE = "ONLINE",
  OFFLINE = "OFFLINE",
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
  status: UserStatus;
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
  status: UserStatus;
  createdAt: Date;
  updatedAt: Date;
}

export interface PasswordUser {
  user: PublicUser;
  passwordHash: string;
}
