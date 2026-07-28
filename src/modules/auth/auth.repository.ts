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
}

export interface AuthSessionRepository {
  create(input: CreateAuthSessionInput): Promise<void>;
  rotate(input: RotateAuthSessionInput): Promise<string | null>;
  deleteById(sessionId: string): Promise<void>;
}

const createMongooseAuthSessionRepository = (): AuthSessionRepository => ({
  async create(input) {
    await AuthSessionModel.create({
      _id: input.id,
      userId: input.userId,
      tokenHash: input.tokenHash,
      expiresAt: input.expiresAt,
    });
  },

  async rotate(input) {
    const session = await AuthSessionModel.findOneAndUpdate(
      {
        _id: input.id,
        tokenHash: input.currentTokenHash,
        expiresAt: { $gt: input.now },
      },
      {
        $set: { tokenHash: input.nextTokenHash },
      },
      {
        new: false,
      },
    )
      .select("userId")
      .lean<{ userId: { toString(): string } }>()
      .exec();

    if (!session) {
      return null;
    }

    return session.userId.toString();
  },

  async deleteById(sessionId) {
    await AuthSessionModel.deleteOne({ _id: sessionId }).exec();
  },
});

export default createMongooseAuthSessionRepository;
