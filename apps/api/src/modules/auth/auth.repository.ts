import type { ClientSession } from "mongoose";

import { AuthSessionModel } from "./auth.model.js";

export interface CreateAuthSessionInput {
  id: string;
  userId: string;
  tokenHash: string;
  expiresAt: Date;
}

export interface RotateAuthSessionInput {
  id: string;
  currentTokenHash: string;
  nextTokenHash: string;
  now: Date;
  reuseGraceMs: number;
}

export interface AuthSessionRepository {
  create(input: CreateAuthSessionInput): Promise<void>;
  rotate(input: RotateAuthSessionInput): Promise<string | null>;
  deleteById(sessionId: string): Promise<void>;
  findUserIdById(sessionId: string): Promise<string | null>;
  deleteByUserId(userId: string): Promise<void>;
}

const createMongooseAuthSessionRepository = (
  session?: ClientSession,
): AuthSessionRepository => ({
  async create(input) {
    await AuthSessionModel.create(
      [
        {
          _id: input.id,
          userId: input.userId,
          tokenHash: input.tokenHash,
          expiresAt: input.expiresAt,
        },
      ],
      session ? { session } : {},
    );
  },

  async rotate(input) {
    const presentsCurrentToken = {
      $eq: ["$tokenHash", input.currentTokenHash],
    };
    const query = AuthSessionModel.findOneAndUpdate(
      {
        _id: input.id,
        expiresAt: { $gt: input.now },
        $or: [
          { tokenHash: input.currentTokenHash },
          {
            previousTokenHash: input.currentTokenHash,
            rotatedAt: {
              $gt: new Date(input.now.getTime() - input.reuseGraceMs),
            },
          },
        ],
      },
      [
        {
          // A grace-window retry must not move the window forward.
          $set: {
            tokenHash: input.nextTokenHash,
            previousTokenHash: {
              $cond: [presentsCurrentToken, "$tokenHash", "$previousTokenHash"],
            },
            rotatedAt: {
              $cond: [presentsCurrentToken, input.now, "$rotatedAt"],
            },
          },
        },
      ],
      {
        new: false,
      },
    )
      .select("userId")
      .lean<{ userId: { toString(): string } }>();
    if (session) query.session(session);
    const authSession = await query.exec();

    if (!authSession) {
      return null;
    }

    return authSession.userId.toString();
  },

  async deleteById(sessionId) {
    const query = AuthSessionModel.deleteOne({ _id: sessionId });
    if (session) query.session(session);
    await query.exec();
  },

  async findUserIdById(sessionId) {
    const query = AuthSessionModel.findById(sessionId)
      .select("userId")
      .lean<{ userId: { toString(): string } }>();
    if (session) query.session(session);
    return (await query.exec())?.userId.toString() ?? null;
  },

  async deleteByUserId(userId) {
    const query = AuthSessionModel.deleteMany({ userId });
    if (session) query.session(session);
    await query.exec();
  },
});

export default createMongooseAuthSessionRepository;
