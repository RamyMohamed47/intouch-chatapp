import { Schema, model } from "mongoose";

import { MailKind, type MailKindValue } from "./mail.types.js";

export interface MailOutboxDocument {
  aggregateKey: string;
  kind: MailKindValue;
  ciphertext: string;
  iv: string;
  authTag: string;
  status: "PENDING" | "PROCESSING" | "SENT" | "FAILED";
  attempts: number;
  availableAt: Date;
  leaseUntil?: Date;
  expiresAt: Date;
  lastError?: string;
  providerMessageId?: string;
  sentAt?: Date;
  purgeAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const mailOutboxSchema = new Schema<MailOutboxDocument>(
  {
    aggregateKey: { type: String, required: true },
    kind: { type: String, enum: Object.values(MailKind), required: true },
    ciphertext: { type: String, required: true },
    iv: { type: String, required: true },
    authTag: { type: String, required: true },
    status: {
      type: String,
      enum: ["PENDING", "PROCESSING", "SENT", "FAILED"],
      default: "PENDING",
      required: true,
    },
    attempts: { type: Number, default: 0, min: 0, required: true },
    availableAt: { type: Date, required: true },
    leaseUntil: Date,
    expiresAt: { type: Date, required: true },
    lastError: String,
    providerMessageId: String,
    sentAt: Date,
    purgeAt: Date,
  },
  { timestamps: true, versionKey: false },
);

mailOutboxSchema.index(
  { aggregateKey: 1 },
  { name: "unique_mail_outbox_aggregate", unique: true },
);
mailOutboxSchema.index(
  { status: 1, availableAt: 1, leaseUntil: 1 },
  { name: "claim_pending_mail" },
);
mailOutboxSchema.index(
  { expiresAt: 1 },
  {
    name: "expire_pending_mail",
    expireAfterSeconds: 0,
    partialFilterExpression: { status: { $in: ["PENDING", "PROCESSING"] } },
  },
);
mailOutboxSchema.index(
  { purgeAt: 1 },
  {
    name: "purge_completed_mail",
    expireAfterSeconds: 0,
    partialFilterExpression: { purgeAt: { $type: "date" } },
  },
);

export const MailOutboxModel = model<MailOutboxDocument>(
  "MailOutbox",
  mailOutboxSchema,
);
