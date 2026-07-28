import { Types } from "mongoose";

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

export interface UserRepository {
  hasIdentityConflict(email: string, username: string): Promise<boolean>;
  createPasswordUser(input: CreatePasswordUserInput): Promise<PublicUser>;
  findPasswordUserByEmail(email: string): Promise<PasswordUser | null>;
  findPublicById(userId: string): Promise<PublicUser | null>;
  touchPasswordProvider(userId: string, usedAt: Date): Promise<void>;
}

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

  async findPublicById(userId) {
    if (!Types.ObjectId.isValid(userId)) {
      return null;
    }

    const user = await UserModel.findById(userId).lean<UserRecord>().exec();

    return user ? toPublicUser(user) : null;
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
});

export default createMongooseUserRepository;
