import { Schema, model } from "mongoose";

import {
  AuthProvider,
  UserStatus,
  type LoginProvider,
  type User,
} from "./user.types.js";

const loginProviderSchema = new Schema<LoginProvider>(
  {
    provider: {
      type: String,
      enum: Object.values(AuthProvider),
      required: true,
    },
    providerAccountId: {
      type: String,
      required: true,
    },
    passwordHash: {
      type: String,
      select: false,
    },
    linkedAt: {
      type: Date,
      default: Date.now,
    },
    lastUsedAt: Date,
    metadata: {
      type: Schema.Types.Mixed,
      default: () => ({}),
    },
  },
  {
    _id: false,
  },
);

const userSchema = new Schema<User>(
  {
    username: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      minlength: 3,
      maxlength: 30,
    },
    displayName: {
      type: String,
      required: true,
      trim: true,
      maxlength: 50,
    },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    avatarUrl: String,
    status: {
      type: String,
      enum: Object.values(UserStatus),
      default: UserStatus.OFFLINE,
    },
    loginProviders: {
      type: [loginProviderSchema],
      default: [],
    },
  },
  {
    timestamps: true,
  },
);

userSchema.index(
  {
    "loginProviders.provider": 1,
    "loginProviders.providerAccountId": 1,
  },
  {
    name: "unique_login_provider_account",
    unique: true,
  },
);

export const UserModel = model<User>("User", userSchema);
