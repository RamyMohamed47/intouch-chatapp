import type {
  AttachmentKindValue,
  UploadFileDescriptor,
  UploadPurposeValue,
} from "@intouch/shared/uploads";

export const StoredAssetStatus = {
  PENDING: "PENDING",
  PROMOTING: "PROMOTING",
  PROMOTED: "PROMOTED",
  READY: "READY",
  DELETE_PENDING: "DELETE_PENDING",
} as const;

export type StoredAssetStatusValue =
  (typeof StoredAssetStatus)[keyof typeof StoredAssetStatus];

export const AssetCleanupMode = {
  DELETE: "DELETE",
  STAGING: "STAGING",
} as const;

export type AssetCleanupModeValue =
  (typeof AssetCleanupMode)[keyof typeof AssetCleanupMode];

export interface StoredAsset {
  ownerUserId: string;
  organizationId?: string;
  conversationId?: string;
  messageId?: string;
  purpose: UploadPurposeValue;
  status: StoredAssetStatusValue;
  stagingKey?: string;
  objectKey: string;
  fileName: string;
  declaredContentType: string;
  declaredSize: number;
  verifiedContentType?: string;
  verifiedSize?: number;
  kind?: AttachmentKindValue;
  etag?: string;
  expiresAt?: Date;
  promotionLeaseUntil?: Date;
  cleanupLeaseUntil?: Date;
  cleanupAttempts: number;
  cleanupAvailableAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface StoredAssetRecord extends StoredAsset {
  id: string;
}

export interface AssetCleanupCandidate {
  asset: StoredAssetRecord;
  mode: AssetCleanupModeValue;
}

export interface CreateStoredAssetInput extends UploadFileDescriptor {
  ownerUserId: string;
  organizationId?: string;
  conversationId?: string;
  purpose: UploadPurposeValue;
  stagingKey: string;
  objectKey: string;
  expiresAt: Date;
}

export interface InspectedObject {
  contentType: string;
  size: number;
  etag: string;
  prefix: Uint8Array;
}

export interface ObjectStorage {
  createUploadUrl(
    key: string,
    contentType: string,
    expiresInSeconds: number,
  ): Promise<string>;
  inspect(key: string): Promise<InspectedObject | null>;
  promote(input: {
    sourceKey: string;
    destinationKey: string;
    etag: string;
    contentType: string;
    contentDisposition: string;
  }): Promise<void>;
  createAccessUrl(key: string, expiresInSeconds: number): Promise<string>;
  deleteObjects(keys: readonly string[]): Promise<void>;
}
