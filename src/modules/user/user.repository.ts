import { Types, type ClientSession } from "mongoose";

import { UserIdentityConflictError } from "./user.errors.js";
import { UserModel } from "./user.model.js";
import {
  AuthProvider,
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
  findPublicByIds(userIds: readonly string[]): Promise<PublicUser[]>;
  findLastSeenByIds(
    userIds: readonly string[],
  ): Promise<Array<{ userId: string; lastSeenAt: Date | null }>>;
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
  updateLastSeen(userId: string, lastSeenAt: Date): Promise<void>;
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
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };

  if (user.avatarUrl) {
    publicUser.avatarUrl = user.avatarUrl;
  }

  return publicUser;
};

const createMongooseUserRepository = (
  session?: ClientSession,
): UserRepository => ({
  async hasIdentityConflict(email, username) {
    const query = UserModel.findOne({
      $or: [{ email }, { username }],
    })
      .select("_id")
      .lean();
    if (session) query.session(session);
    const user = await query.exec();

    return user !== null;
  },

  async createPasswordUser(input) {
    const createdAt = new Date();

    try {
      const users = await UserModel.create(
        [
          {
            username: input.username,
            displayName: input.displayName,
            email: input.email,
            loginProviders: [
              {
                provider: AuthProvider.PASSWORD,
                providerAccountId: input.email,
                passwordHash: input.passwordHash,
                linkedAt: createdAt,
              },
            ],
          },
        ],
        session ? { session } : {},
      );
      const user = users[0];
      if (!user) throw new Error("User creation returned no document");

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
      const users = await UserModel.create(
        [
          {
            username: input.username,
            displayName: input.displayName,
            email: input.email,
            ...(input.avatarUrl ? { avatarUrl: input.avatarUrl } : {}),
            loginProviders: [
              {
                provider: AuthProvider.GOOGLE,
                providerAccountId: input.providerAccountId,
                linkedAt: input.usedAt,
                lastUsedAt: input.usedAt,
              },
            ],
          },
        ],
        session ? { session } : {},
      );
      const user = users[0];
      if (!user) throw new Error("User creation returned no document");

      return toPublicUser(user.toObject<UserRecord>());
    } catch (error) {
      if (isDuplicateKeyError(error)) {
        throw new UserIdentityConflictError({ cause: error });
      }

      throw error;
    }
  },

  async findPasswordUserByEmail(email) {
    const query = UserModel.findOne({ email })
      .select("+loginProviders.passwordHash")
      .lean<UserRecord>();
    if (session) query.session(session);
    const user = await query.exec();
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
    const query = UserModel.findOne({ email }).lean<UserRecord>();
    if (session) query.session(session);
    const user = await query.exec();

    return user ? toPublicUser(user) : null;
  },

  async findPublicById(userId) {
    if (!Types.ObjectId.isValid(userId)) {
      return null;
    }

    const query = UserModel.findById(userId).lean<UserRecord>();
    if (session) query.session(session);
    const user = await query.exec();

    return user ? toPublicUser(user) : null;
  },

  async findPublicByIds(userIds) {
    if (userIds.length === 0) {
      return [];
    }

    const query = UserModel.find({ _id: { $in: userIds } }).lean<
      UserRecord[]
    >();
    if (session) query.session(session);
    const users = await query.exec();

    return users.map(toPublicUser);
  },

  async findLastSeenByIds(userIds) {
    if (userIds.length === 0) return [];
    const query = UserModel.find({ _id: { $in: userIds } })
      .select("lastSeenAt")
      .lean<Array<{ _id: Types.ObjectId; lastSeenAt?: Date }>>();
    if (session) query.session(session);
    const users = await query.exec();
    return users.map((user) => ({
      userId: user._id.toString(),
      lastSeenAt: user.lastSeenAt ?? null,
    }));
  },

  async linkGoogleProvider(userId, providerAccountId, usedAt) {
    try {
      const query = UserModel.findOneAndUpdate(
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
      ).lean<UserRecord>();
      if (session) query.session(session);
      const user = await query.exec();

      return user ? toPublicUser(user) : null;
    } catch (error) {
      if (isDuplicateKeyError(error)) {
        throw new UserIdentityConflictError({ cause: error });
      }

      throw error;
    }
  },

  async touchPasswordProvider(userId, usedAt) {
    const query = UserModel.updateOne(
      {
        _id: userId,
        loginProviders: {
          $elemMatch: { provider: AuthProvider.PASSWORD },
        },
      },
      {
        $set: { "loginProviders.$.lastUsedAt": usedAt },
      },
    );
    if (session) query.session(session);
    await query.exec();
  },

  async useGoogleProvider(providerAccountId, usedAt) {
    const query = UserModel.findOneAndUpdate(
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
    ).lean<UserRecord>();
    if (session) query.session(session);
    const user = await query.exec();

    return user ? toPublicUser(user) : null;
  },

  async usernameExists(username) {
    const query = UserModel.findOne({ username }).select("_id").lean();
    if (session) query.session(session);
    const user = await query.exec();

    return user !== null;
  },

  async updateLastSeen(userId, lastSeenAt) {
    const query = UserModel.updateOne(
      { _id: userId },
      { $set: { lastSeenAt } },
    );
    if (session) query.session(session);
    await query.exec();
  },
});

export default createMongooseUserRepository;
