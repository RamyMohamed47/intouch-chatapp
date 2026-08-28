import type { ClientSession } from "mongoose";

import {
  AuthActionTokenModel,
  type AuthActionPurposeValue,
} from "./auth.action-token.model.js";

export interface ReplaceAuthActionTokenInput {
  id: string;
  userId: string;
  purpose: AuthActionPurposeValue;
  secretHash: string;
  expiresAt: Date;
}

export interface ConsumeAuthActionTokenInput {
  id: string;
  purpose: AuthActionPurposeValue;
  secretHash: string;
  now: Date;
}

export interface AuthActionTokenRepository {
  replace(input: ReplaceAuthActionTokenInput): Promise<void>;
  consume(input: ConsumeAuthActionTokenInput): Promise<string | null>;
  deleteForUser(userId: string, purpose: AuthActionPurposeValue): Promise<void>;
}

export const createMongooseAuthActionTokenRepository = (
  session?: ClientSession,
): AuthActionTokenRepository => ({
  async replace(input) {
    const deleteQuery = AuthActionTokenModel.deleteOne({
      userId: input.userId,
      purpose: input.purpose,
    });
    if (session) deleteQuery.session(session);
    await deleteQuery.exec();

    await AuthActionTokenModel.create(
      [
        {
          _id: input.id,
          userId: input.userId,
          purpose: input.purpose,
          secretHash: input.secretHash,
          expiresAt: input.expiresAt,
        },
      ],
      session ? { session } : {},
    );
  },

  async consume(input) {
    const query = AuthActionTokenModel.findOneAndDelete({
      _id: input.id,
      purpose: input.purpose,
      secretHash: input.secretHash,
      expiresAt: { $gt: input.now },
    })
      .select("userId")
      .lean<{ userId: { toString(): string } }>();
    if (session) query.session(session);
    const token = await query.exec();
    return token?.userId.toString() ?? null;
  },

  async deleteForUser(userId, purpose) {
    const query = AuthActionTokenModel.deleteOne({ userId, purpose });
    if (session) query.session(session);
    await query.exec();
  },
});
