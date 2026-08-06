import { Schema, model } from "mongoose";

export interface LoginAttempt {
  identifierHash: string;
  attemptCount: number;
  windowStartedAt: Date;
  blockedUntil?: Date;
  expiresAt: Date;
}

const loginAttemptSchema = new Schema<LoginAttempt>(
  {
    identifierHash: {
      type: String,
      required: true,
    },
    attemptCount: {
      type: Number,
      required: true,
      min: 1,
    },
    windowStartedAt: {
      type: Date,
      required: true,
    },
    blockedUntil: Date,
    expiresAt: {
      type: Date,
      required: true,
    },
  },
  {
    versionKey: false,
  },
);

loginAttemptSchema.index(
  { identifierHash: 1 },
  { name: "unique_login_attempt_identifier", unique: true },
);
loginAttemptSchema.index(
  { expiresAt: 1 },
  { name: "expire_login_attempts", expireAfterSeconds: 0 },
);

export const LoginAttemptModel = model<LoginAttempt>(
  "LoginAttempt",
  loginAttemptSchema,
);
