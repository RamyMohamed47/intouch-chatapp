import { model, Schema, type Types } from "mongoose";

export const CallAlertKind = {
  INCOMING: "INCOMING",
  STATE_CHANGED: "STATE_CHANGED",
} as const;

export type CallAlertKindValue =
  (typeof CallAlertKind)[keyof typeof CallAlertKind];

export interface CallAlertOutboxDocument {
  callId: string;
  recipientUserId: Types.ObjectId;
  kind: CallAlertKindValue;
  status: "PENDING" | "SENDING" | "COMPLETE" | "FAILED";
  attempts: number;
  availableAt: Date;
  expiresAt: Date;
  dispatchedAt?: Date;
  leaseUntil?: Date;
  lastError?: string;
  purgeAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const callAlertOutboxSchema = new Schema<CallAlertOutboxDocument>(
  {
    callId: { type: String, required: true },
    recipientUserId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    kind: {
      type: String,
      enum: Object.values(CallAlertKind),
      required: true,
    },
    status: {
      type: String,
      enum: ["PENDING", "SENDING", "COMPLETE", "FAILED"],
      default: "PENDING",
      required: true,
    },
    attempts: { type: Number, min: 0, default: 0, required: true },
    availableAt: { type: Date, required: true },
    expiresAt: { type: Date, required: true },
    dispatchedAt: Date,
    leaseUntil: Date,
    lastError: String,
    purgeAt: Date,
  },
  { timestamps: true, versionKey: false },
);

callAlertOutboxSchema.index(
  { callId: 1, recipientUserId: 1, kind: 1 },
  { name: "unique_call_alert", unique: true },
);
callAlertOutboxSchema.index(
  { status: 1, availableAt: 1, leaseUntil: 1 },
  { name: "claim_call_alert" },
);
callAlertOutboxSchema.index(
  { purgeAt: 1 },
  { name: "purge_call_alerts", expireAfterSeconds: 0 },
);

export const CallAlertOutboxModel = model<CallAlertOutboxDocument>(
  "CallAlertOutbox",
  callAlertOutboxSchema,
);
