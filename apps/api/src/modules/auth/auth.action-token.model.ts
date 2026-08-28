import { Schema, model } from "mongoose";
import type { Types } from "mongoose";

export const AuthActionPurpose = {
  VERIFY_EMAIL: "VERIFY_EMAIL",
  RESET_PASSWORD: "RESET_PASSWORD",
} as const;

export type AuthActionPurposeValue =
  (typeof AuthActionPurpose)[keyof typeof AuthActionPurpose];

export interface AuthActionToken {
  _id: string;
  userId: Types.ObjectId;
  purpose: AuthActionPurposeValue;
  secretHash: string;
  expiresAt: Date;
  createdAt: Date;
}

const authActionTokenSchema = new Schema<AuthActionToken>(
  {
    _id: { type: String, required: true },
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    purpose: {
      type: String,
      enum: Object.values(AuthActionPurpose),
      required: true,
    },
    secretHash: { type: String, required: true },
    expiresAt: { type: Date, required: true },
  },
  { timestamps: { createdAt: true, updatedAt: false }, versionKey: false },
);

authActionTokenSchema.index(
  { userId: 1, purpose: 1 },
  { name: "unique_auth_action_per_user", unique: true },
);
authActionTokenSchema.index(
  { expiresAt: 1 },
  { name: "expire_auth_action_tokens", expireAfterSeconds: 0 },
);

export const AuthActionTokenModel = model<AuthActionToken>(
  "AuthActionToken",
  authActionTokenSchema,
);
