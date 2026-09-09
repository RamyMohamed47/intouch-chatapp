import { Schema, model, type Types } from "mongoose";

export type PushOutboxStatus =
  | "PENDING"
  | "SENDING"
  | "WAITING_RECEIPT"
  | "CHECKING_RECEIPT"
  | "COMPLETE"
  | "FAILED";

export interface PushOutboxDocument {
  notificationId: Types.ObjectId;
  recipientUserId: Types.ObjectId;
  pushVersion: number;
  status: PushOutboxStatus;
  attempts: number;
  receiptAttempts: number;
  availableAt: Date;
  expiresAt: Date;
  dispatchedAt?: Date;
  leaseUntil?: Date;
  receiptAvailableAt?: Date;
  receiptDispatchedAt?: Date;
  tickets: { deviceId: Types.ObjectId; ticketId: string }[];
  lastError?: string;
  purgeAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const pushTicketSchema = new Schema(
  {
    deviceId: {
      type: Schema.Types.ObjectId,
      ref: "PushDevice",
      required: true,
    },
    ticketId: { type: String, required: true },
  },
  { _id: false },
);

const pushOutboxSchema = new Schema<PushOutboxDocument>(
  {
    notificationId: {
      type: Schema.Types.ObjectId,
      ref: "Notification",
      required: true,
    },
    recipientUserId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    pushVersion: { type: Number, min: 1, required: true },
    status: {
      type: String,
      enum: [
        "PENDING",
        "SENDING",
        "WAITING_RECEIPT",
        "CHECKING_RECEIPT",
        "COMPLETE",
        "FAILED",
      ],
      default: "PENDING",
      required: true,
    },
    attempts: { type: Number, default: 0, min: 0, required: true },
    receiptAttempts: { type: Number, default: 0, min: 0, required: true },
    availableAt: { type: Date, required: true },
    expiresAt: { type: Date, required: true },
    dispatchedAt: Date,
    leaseUntil: Date,
    receiptAvailableAt: Date,
    receiptDispatchedAt: Date,
    tickets: { type: [pushTicketSchema], default: [] },
    lastError: String,
    purgeAt: Date,
  },
  { timestamps: true, versionKey: false },
);

pushOutboxSchema.index(
  { notificationId: 1, pushVersion: 1 },
  { name: "unique_notification_push_version", unique: true },
);
pushOutboxSchema.index(
  { status: 1, availableAt: 1, leaseUntil: 1 },
  { name: "claim_push_delivery" },
);
pushOutboxSchema.index(
  { status: 1, receiptAvailableAt: 1, leaseUntil: 1 },
  { name: "claim_push_receipt" },
);
pushOutboxSchema.index(
  { purgeAt: 1 },
  {
    name: "purge_push_outbox",
    expireAfterSeconds: 0,
    partialFilterExpression: { purgeAt: { $type: "date" } },
  },
);

export const PushOutboxModel = model<PushOutboxDocument>(
  "PushOutbox",
  pushOutboxSchema,
);
