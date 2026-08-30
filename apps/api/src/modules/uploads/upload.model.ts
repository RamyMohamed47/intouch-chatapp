import { Schema, model } from "mongoose";
import { UploadPurpose } from "@intouch/shared/uploads";

import { StoredAssetStatus, type StoredAsset } from "./upload.types.js";

const storedAssetSchema = new Schema<StoredAsset>(
  {
    ownerUserId: { type: String, required: true },
    organizationId: String,
    conversationId: String,
    messageId: String,
    purpose: {
      type: String,
      enum: Object.values(UploadPurpose),
      required: true,
    },
    status: {
      type: String,
      enum: Object.values(StoredAssetStatus),
      required: true,
      default: StoredAssetStatus.PENDING,
    },
    stagingKey: { type: String, unique: true, sparse: true },
    objectKey: { type: String, required: true, unique: true },
    fileName: { type: String, required: true, maxlength: 255 },
    declaredContentType: { type: String, required: true },
    declaredSize: { type: Number, required: true, min: 1 },
    verifiedContentType: String,
    verifiedSize: Number,
    kind: String,
    etag: String,
    expiresAt: Date,
    promotionLeaseUntil: Date,
    cleanupLeaseUntil: Date,
    cleanupAttempts: { type: Number, required: true, default: 0 },
    cleanupAvailableAt: { type: Date, required: true, default: Date.now },
  },
  { timestamps: true },
);

storedAssetSchema.index(
  { ownerUserId: 1, status: 1 },
  { name: "assets_by_owner_status" },
);
storedAssetSchema.index(
  { organizationId: 1, status: 1 },
  { name: "assets_by_organization_status" },
);
storedAssetSchema.index(
  { conversationId: 1, messageId: 1, status: 1 },
  { name: "assets_by_message" },
);
storedAssetSchema.index(
  { status: 1, expiresAt: 1, cleanupAvailableAt: 1 },
  { name: "asset_cleanup_candidates" },
);

export const StoredAssetModel = model<StoredAsset>(
  "StoredAsset",
  storedAssetSchema,
);

interface UploadDailyUsage {
  userId: string;
  dayKey: string;
  bytes: number;
  expiresAt: Date;
}

const uploadDailyUsageSchema = new Schema<UploadDailyUsage>(
  {
    userId: { type: String, required: true },
    dayKey: { type: String, required: true },
    bytes: { type: Number, required: true, min: 0 },
    expiresAt: { type: Date, required: true },
  },
  { timestamps: true },
);

uploadDailyUsageSchema.index(
  { userId: 1, dayKey: 1 },
  { name: "unique_daily_upload_usage", unique: true },
);
uploadDailyUsageSchema.index(
  { expiresAt: 1 },
  { name: "upload_usage_expiry", expireAfterSeconds: 0 },
);

export const UploadDailyUsageModel = model<UploadDailyUsage>(
  "UploadDailyUsage",
  uploadDailyUsageSchema,
);
