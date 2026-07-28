import { Schema, model } from "mongoose";

import type { Types } from "mongoose";

export interface AuthSession {
  _id: string;
  userId: Types.ObjectId;
  tokenHash: string;
  expiresAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

const authSessionSchema = new Schema<AuthSession>(
  {
    _id: {
      type: String,
      required: true,
    },
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    tokenHash: {
      type: String,
      required: true,
    },
    expiresAt: {
      type: Date,
      required: true,
      index: { expires: 0 },
    },
  },
  {
    timestamps: true,
  },
);

export const AuthSessionModel = model<AuthSession>(
  "AuthSession",
  authSessionSchema,
);
