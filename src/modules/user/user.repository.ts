import { Types } from "mongoose";

import { UserIdentityConflictError } from "./user.errors.js";
import { UserModel } from "./user.model.js";
import {
  AuthProvider,
  UserStatus,
  type PasswordUser,
  type PublicUser,
  type User,
} from "./user.types.js";

interface UserRecord extends User {
  _id: Types.ObjectId;
}

export interface CreatePasswordUserInput {
  username: string;
  displayName: string;
  email: string;
  passwordHash: string;
}

export interface CreateGoogleUserInput {
  username: string;
  displayName: string;
  email: string;
  avatarUrl?: string;
  providerAccountId: string;
  usedAt: Date;
}

export interface UserRepository {
  hasIdentityConflict(email: string, username: string): Promise<boolean>;
  createPasswordUser(input: CreatePasswordUserInput): Promise<PublicUser>;
  createGoogleUser(input: CreateGoogleUserInput): Promise<PublicUser>;
  findPasswordUserByEmail(email: string): Promise<PasswordUser | null>;
  findPublicByEmail(email: string): Promise<PublicUser | null>;
  findPublicById(userId: string): Promise<PublicUser | null>;
  linkGoogleProvider(
    userId: string,
    providerAccountId: string,
    usedAt: Date,
  ): Promise<PublicUser | null>;
  touchPasswordProvider(userId: string, usedAt: Date): Promise<void>;
  useGoogleProvider(
    providerAccountId: string,
    usedAt: Date,
  ): Promise<PublicUser | null>;
  usernameExists(username: string): Promise<boolean>;
}

const isDuplicateKeyError = (error: unknown) =>
  typeof error === "object" &&
  error !== null &&
  "code" in error &&
  error.code === 11000;

const toPublicUser = (user: UserRecord): PublicUser => {
  const publicUser: PublicUser = {
    id: user._id.toString(),
    username: user.username,
    displayName: user.displayName,
    email: user.email,
    status: user.status,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };

  if (user.avatarUrl) {
    publicUser.avatarUrl = user.avatarUrl;
  }

  return publicUser;
};

const createMongooseUserRepository = (): UserRepository => ({
  async hasIdentityConflict(email, username) {
    const user = await UserModel.findOne({
      $or: [{ email }, { username }],
    })
      .select("_id")
      .lean()
      .exec();

    return user !== null;
  },

  async createPasswordUser(input) {
    const createdAt = new Date();

    try {
      const user = await UserModel.create({
        username: input.username,
        displayName: input.displayName,
        email: input.email,
        status: UserStatus.OFFLINE,
        loginProviders: [
          {
            provider: AuthProvider.PASSWORD,
            providerAccountId: input.email,
            passwordHash: input.passwordHash,
            linkedAt: createdAt,
          },
        ],
      });

      return toPublicUser(user.toObject<UserRecord>());
    } catch (error) {
      if (isDuplicateKeyError(error)) {
        throw new UserIdentityConflictError({ cause: error });
      }

      throw error;
    }
  },

  async createGoogleUser(input) {
    try {
      const user = await UserModel.create({
        username: input.username,
        displayName: input.displayName,
        email: input.email,
        ...(input.avatarUrl ? { avatarUrl: input.avatarUrl } : {}),
        status: UserStatus.OFFLINE,
        loginProviders: [
          {
            provider: AuthProvider.GOOGLE,
            providerAccountId: input.providerAccountId,
            linkedAt: input.usedAt,
            lastUsedAt: input.usedAt,
          },
        ],
      });

      return toPublicUser(user.toObject<UserRecord>());
    } catch (error) {
      if (isDuplicateKeyError(error)) {
        throw new UserIdentityConflictError({ cause: error });
      }

      throw error;
    }
  },

  async findPasswordUserByEmail(email) {
    const user = await UserModel.findOne({ email })
      .select("+loginProviders.passwordHash")
      .lean<UserRecord>()
      .exec();
    const passwordProvider = user?.loginProviders.find(
      (provider) => provider.provider === AuthProvider.PASSWORD,
    );

    if (!user || !passwordProvider?.passwordHash) {
      return null;
    }

    return {
      user: toPublicUser(user),
      passwordHash: passwordProvider.passwordHash,
    };
  },

  async findPublicByEmail(email) {
    const user = await UserModel.findOne({ email }).lean<UserRecord>().exec();

    return user ? toPublicUser(user) : null;
  },

  async findPublicById(userId) {
    if (!Types.ObjectId.isValid(userId)) {
      return null;
    }

    const user = await UserModel.findById(userId).lean<UserRecord>().exec();

    return user ? toPublicUser(user) : null;
  },

  async linkGoogleProvider(userId, providerAccountId, usedAt) {
    try {
      const user = await UserModel.findOneAndUpdate(
        {
          _id: userId,
          loginProviders: {
            $not: { $elemMatch: { provider: AuthProvider.GOOGLE } },
          },
        },
        {
          $push: {
            loginProviders: {
              provider: AuthProvider.GOOGLE,
              providerAccountId,
              linkedAt: usedAt,
              lastUsedAt: usedAt,
            },
          },
        },
        { new: true },
      )
        .lean<UserRecord>()
        .exec();

      return user ? toPublicUser(user) : null;
    } catch (error) {
      if (isDuplicateKeyError(error)) {
        throw new UserIdentityConflictError({ cause: error });
      }

      throw error;
    }
  },

  async touchPasswordProvider(userId, usedAt) {
    await UserModel.updateOne(
      {
        _id: userId,
        loginProviders: {
          $elemMatch: { provider: AuthProvider.PASSWORD },
        },
      },
      {
        $set: { "loginProviders.$.lastUsedAt": usedAt },
      },
    ).exec();
  },

  async useGoogleProvider(providerAccountId, usedAt) {
    const user = await UserModel.findOneAndUpdate(
      {
        loginProviders: {
          $elemMatch: {
            provider: AuthProvider.GOOGLE,
            providerAccountId,
          },
        },
      },
      {
        $set: { "loginProviders.$.lastUsedAt": usedAt },
      },
      { new: true },
    )
      .lean<UserRecord>()
      .exec();

    return user ? toPublicUser(user) : null;
  },

  async usernameExists(username) {
    const user = await UserModel.findOne({ username })
      .select("_id")
      .lean()
      .exec();

    return user !== null;
  },
});

export default createMongooseUserRepository;
