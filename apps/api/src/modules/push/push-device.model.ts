import { Schema, model, type Types } from "mongoose";

import { PushPlatform, type PushPlatformValue } from "@intouch/shared/push";

export interface PushDeviceDocument {
  userId: Types.ObjectId;
  installationId: string;
  platform: PushPlatformValue;
  tokenHash: string;
  ciphertext: string;
  iv: string;
  authTag: string;
  enabled: boolean;
  lastRegisteredAt: Date;
  invalidatedAt?: Date;
  purgeAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const pushDeviceSchema = new Schema<PushDeviceDocument>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    installationId: { type: String, required: true },
    platform: {
      type: String,
      enum: Object.values(PushPlatform),
      required: true,
    },
    tokenHash: { type: String, required: true },
    ciphertext: { type: String, required: true },
    iv: { type: String, required: true },
    authTag: { type: String, required: true },
    enabled: { type: Boolean, default: true, required: true },
    lastRegisteredAt: { type: Date, required: true },
    invalidatedAt: Date,
    purgeAt: Date,
  },
  { timestamps: true, versionKey: false },
);

pushDeviceSchema.index(
  { installationId: 1 },
  { name: "unique_push_installation", unique: true },
);
pushDeviceSchema.index(
  { tokenHash: 1 },
  { name: "unique_push_token", unique: true },
);
pushDeviceSchema.index(
  { userId: 1, enabled: 1 },
  { name: "active_push_devices_by_user" },
);
pushDeviceSchema.index(
  { purgeAt: 1 },
  {
    name: "purge_invalid_push_devices",
    expireAfterSeconds: 0,
    partialFilterExpression: { purgeAt: { $type: "date" } },
  },
);

export const PushDeviceModel = model<PushDeviceDocument>(
  "PushDevice",
  pushDeviceSchema,
);
