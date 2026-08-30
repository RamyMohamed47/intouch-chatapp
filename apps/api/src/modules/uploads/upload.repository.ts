import { Types, type ClientSession } from "mongoose";
import type {
  AttachmentKindValue,
  UploadPurposeValue,
} from "@intouch/shared/uploads";

import { StoredAssetModel, UploadDailyUsageModel } from "./upload.model.js";
import {
  StoredAssetStatus,
  type CreateStoredAssetInput,
  type AssetCleanupCandidate,
  type AssetCleanupModeValue,
  type StoredAsset,
  type StoredAssetRecord,
} from "./upload.types.js";

interface StoredAssetDocument extends StoredAsset {
  _id: Types.ObjectId;
}

const toRecord = (asset: StoredAssetDocument): StoredAssetRecord => ({
  id: asset._id.toString(),
  ownerUserId: asset.ownerUserId,
  ...(asset.organizationId ? { organizationId: asset.organizationId } : {}),
  ...(asset.conversationId ? { conversationId: asset.conversationId } : {}),
  ...(asset.messageId ? { messageId: asset.messageId } : {}),
  purpose: asset.purpose,
  status: asset.status,
  ...(asset.stagingKey ? { stagingKey: asset.stagingKey } : {}),
  objectKey: asset.objectKey,
  fileName: asset.fileName,
  declaredContentType: asset.declaredContentType,
  declaredSize: asset.declaredSize,
  ...(asset.verifiedContentType
    ? { verifiedContentType: asset.verifiedContentType }
    : {}),
  ...(asset.verifiedSize !== undefined
    ? { verifiedSize: asset.verifiedSize }
    : {}),
  ...(asset.kind ? { kind: asset.kind } : {}),
  ...(asset.etag ? { etag: asset.etag } : {}),
  ...(asset.expiresAt ? { expiresAt: asset.expiresAt } : {}),
  ...(asset.promotionLeaseUntil
    ? { promotionLeaseUntil: asset.promotionLeaseUntil }
    : {}),
  ...(asset.cleanupLeaseUntil
    ? { cleanupLeaseUntil: asset.cleanupLeaseUntil }
    : {}),
  cleanupAttempts: asset.cleanupAttempts,
  cleanupAvailableAt: asset.cleanupAvailableAt,
  createdAt: asset.createdAt,
  updatedAt: asset.updatedAt,
});

export interface StoredAssetRepository {
  createMany(
    inputs: readonly CreateStoredAssetInput[],
  ): Promise<StoredAssetRecord[]>;
  findById(assetId: string): Promise<StoredAssetRecord | null>;
  findReadyById(assetId: string): Promise<StoredAssetRecord | null>;
  listReadyByMessageIds(
    messageIds: readonly string[],
  ): Promise<StoredAssetRecord[]>;
  countPendingByOwner(userId: string): Promise<number>;
  sumActiveBytesByOrganization(organizationId: string): Promise<number>;
  claimForPromotion(
    assetId: string,
    ownerUserId: string,
    now: Date,
    leaseUntil: Date,
  ): Promise<StoredAssetRecord | null>;
  markPromoted(
    assetId: string,
    ownerUserId: string,
    input: {
      etag: string;
      kind: AttachmentKindValue;
      contentType: string;
      size: number;
    },
  ): Promise<StoredAssetRecord | null>;
  releasePromotion(assetId: string, ownerUserId: string): Promise<void>;
  markDeletePending(assetId: string, ownerUserId?: string): Promise<boolean>;
  markClaimedForDeletion(assetId: string): Promise<boolean>;
  claimForMessage(input: {
    assetIds: readonly string[];
    ownerUserId: string;
    conversationId: string;
    messageId: string;
    now: Date;
  }): Promise<StoredAssetRecord[]>;
  claimAvatar(
    assetId: string,
    ownerUserId: string,
    now: Date,
  ): Promise<StoredAssetRecord | null>;
  claimOrganizationLogo(input: {
    assetId: string;
    ownerUserId: string;
    organizationId: string;
    now: Date;
  }): Promise<StoredAssetRecord | null>;
  markMessageAssetsForDeletion(messageId: string): Promise<number>;
  markConversationAssetsForDeletion(conversationId: string): Promise<number>;
  markOrganizationAssetsForDeletion(organizationId: string): Promise<number>;
  claimNextCleanup(
    now: Date,
    leaseUntil: Date,
  ): Promise<StoredAssetRecord | null>;
  claimNextStagingCleanup(
    now: Date,
    leaseUntil: Date,
  ): Promise<StoredAssetRecord | null>;
  listCleanupCandidates(
    now: Date,
    limit: number,
  ): Promise<AssetCleanupCandidate[]>;
  claimCleanupById(
    assetId: string,
    mode: AssetCleanupModeValue,
    now: Date,
    leaseUntil: Date,
  ): Promise<StoredAssetRecord | null>;
  completeCleanup(assetId: string): Promise<void>;
  completeStagingCleanup(assetId: string): Promise<void>;
  scheduleCleanupRetry(assetId: string, availableAt: Date): Promise<void>;
}

const activeStatuses = Object.values(StoredAssetStatus);

export const createMongooseStoredAssetRepository = (
  session?: ClientSession,
): StoredAssetRepository => ({
  async createMany(inputs) {
    const created = await StoredAssetModel.create(
      inputs.map((input) => ({
        ownerUserId: input.ownerUserId,
        organizationId: input.organizationId,
        conversationId: input.conversationId,
        purpose: input.purpose,
        status: StoredAssetStatus.PENDING,
        stagingKey: input.stagingKey,
        objectKey: input.objectKey,
        fileName: input.fileName,
        declaredContentType: input.contentType,
        declaredSize: input.size,
        expiresAt: input.expiresAt,
      })),
      session ? { session } : {},
    );
    return created.map((asset) =>
      toRecord(asset.toObject<StoredAssetDocument>()),
    );
  },

  async findById(assetId) {
    if (!Types.ObjectId.isValid(assetId)) return null;
    const query =
      StoredAssetModel.findById(assetId).lean<StoredAssetDocument>();
    if (session) query.session(session);
    const asset = await query.exec();
    return asset ? toRecord(asset) : null;
  },

  async findReadyById(assetId) {
    if (!Types.ObjectId.isValid(assetId)) return null;
    const query = StoredAssetModel.findOne({
      _id: assetId,
      status: StoredAssetStatus.READY,
    }).lean<StoredAssetDocument>();
    if (session) query.session(session);
    const asset = await query.exec();
    return asset ? toRecord(asset) : null;
  },

  async listReadyByMessageIds(messageIds) {
    if (messageIds.length === 0) return [];
    const query = StoredAssetModel.find({
      messageId: { $in: messageIds },
      status: StoredAssetStatus.READY,
    })
      .sort({ _id: 1 })
      .lean<StoredAssetDocument[]>();
    if (session) query.session(session);
    return (await query.exec()).map(toRecord);
  },

  async countPendingByOwner(userId) {
    const query = StoredAssetModel.countDocuments({
      ownerUserId: userId,
      status: {
        $in: [
          StoredAssetStatus.PENDING,
          StoredAssetStatus.PROMOTING,
          StoredAssetStatus.PROMOTED,
        ],
      },
    });
    if (session) query.session(session);
    return query.exec();
  },

  async sumActiveBytesByOrganization(organizationId) {
    const query = StoredAssetModel.aggregate<{ total: number }>([
      {
        $match: {
          organizationId,
          purpose: "MESSAGE_ATTACHMENT" satisfies UploadPurposeValue,
          status: { $in: activeStatuses },
        },
      },
      { $group: { _id: null, total: { $sum: "$declaredSize" } } },
    ]);
    if (session) query.session(session);
    return (await query.exec())[0]?.total ?? 0;
  },

  async claimForPromotion(assetId, ownerUserId, now, leaseUntil) {
    const query = StoredAssetModel.findOneAndUpdate(
      {
        _id: assetId,
        ownerUserId,
        expiresAt: { $gt: now },
        $or: [
          { status: StoredAssetStatus.PENDING },
          {
            status: StoredAssetStatus.PROMOTING,
            promotionLeaseUntil: { $lte: now },
          },
        ],
      },
      {
        $set: {
          status: StoredAssetStatus.PROMOTING,
          promotionLeaseUntil: leaseUntil,
        },
      },
      { new: true },
    ).lean<StoredAssetDocument>();
    if (session) query.session(session);
    const asset = await query.exec();
    return asset ? toRecord(asset) : null;
  },

  async markPromoted(assetId, ownerUserId, input) {
    const query = StoredAssetModel.findOneAndUpdate(
      {
        _id: assetId,
        ownerUserId,
        status: StoredAssetStatus.PROMOTING,
      },
      {
        $set: {
          status: StoredAssetStatus.PROMOTED,
          etag: input.etag,
          kind: input.kind,
          verifiedContentType: input.contentType,
          verifiedSize: input.size,
        },
        $unset: { promotionLeaseUntil: 1 },
      },
      { new: true },
    ).lean<StoredAssetDocument>();
    if (session) query.session(session);
    const asset = await query.exec();
    return asset ? toRecord(asset) : null;
  },

  async releasePromotion(assetId, ownerUserId) {
    const query = StoredAssetModel.updateOne(
      {
        _id: assetId,
        ownerUserId,
        status: StoredAssetStatus.PROMOTING,
      },
      {
        $set: { status: StoredAssetStatus.PENDING },
        $unset: { promotionLeaseUntil: 1 },
      },
    );
    if (session) query.session(session);
    await query.exec();
  },

  async markDeletePending(assetId, ownerUserId) {
    const query = StoredAssetModel.updateOne(
      {
        _id: assetId,
        ...(ownerUserId ? { ownerUserId } : {}),
        status: { $ne: StoredAssetStatus.READY },
      },
      {
        $set: {
          status: StoredAssetStatus.DELETE_PENDING,
          cleanupAvailableAt: new Date(),
        },
        $unset: { promotionLeaseUntil: 1 },
      },
    );
    if (session) query.session(session);
    return (await query.exec()).matchedCount === 1;
  },

  async markClaimedForDeletion(assetId) {
    const query = StoredAssetModel.updateOne(
      { _id: assetId, status: StoredAssetStatus.READY },
      {
        $set: {
          status: StoredAssetStatus.DELETE_PENDING,
          cleanupAvailableAt: new Date(),
        },
      },
    );
    if (session) query.session(session);
    return (await query.exec()).matchedCount === 1;
  },

  async claimForMessage(input) {
    if (input.assetIds.length === 0) return [];
    const query = StoredAssetModel.updateMany(
      {
        _id: { $in: input.assetIds },
        ownerUserId: input.ownerUserId,
        conversationId: input.conversationId,
        purpose: "MESSAGE_ATTACHMENT" satisfies UploadPurposeValue,
        status: StoredAssetStatus.PROMOTED,
        expiresAt: { $gt: input.now },
      },
      {
        $set: {
          status: StoredAssetStatus.READY,
          messageId: input.messageId,
        },
        $unset: { expiresAt: 1 },
      },
    );
    if (session) query.session(session);
    await query.exec();
    const find = StoredAssetModel.find({
      _id: { $in: input.assetIds },
      ownerUserId: input.ownerUserId,
      conversationId: input.conversationId,
      messageId: input.messageId,
      status: StoredAssetStatus.READY,
    })
      .sort({ _id: 1 })
      .lean<StoredAssetDocument[]>();
    if (session) find.session(session);
    return (await find.exec()).map(toRecord);
  },

  async claimAvatar(assetId, ownerUserId, now) {
    const query = StoredAssetModel.findOneAndUpdate(
      {
        _id: assetId,
        ownerUserId,
        purpose: "AVATAR" satisfies UploadPurposeValue,
        status: StoredAssetStatus.PROMOTED,
        expiresAt: { $gt: now },
      },
      {
        $set: { status: StoredAssetStatus.READY },
        $unset: { expiresAt: 1 },
      },
      { new: true },
    ).lean<StoredAssetDocument>();
    if (session) query.session(session);
    const asset = await query.exec();
    return asset ? toRecord(asset) : null;
  },

  async claimOrganizationLogo(input) {
    const query = StoredAssetModel.findOneAndUpdate(
      {
        _id: input.assetId,
        ownerUserId: input.ownerUserId,
        purpose: "ORGANIZATION_LOGO" satisfies UploadPurposeValue,
        status: StoredAssetStatus.PROMOTED,
        expiresAt: { $gt: input.now },
      },
      {
        $set: {
          status: StoredAssetStatus.READY,
          organizationId: input.organizationId,
        },
        $unset: { expiresAt: 1 },
      },
      { new: true },
    ).lean<StoredAssetDocument>();
    if (session) query.session(session);
    const asset = await query.exec();
    return asset ? toRecord(asset) : null;
  },

  async markMessageAssetsForDeletion(messageId) {
    const query = StoredAssetModel.updateMany(
      { messageId, status: StoredAssetStatus.READY },
      {
        $set: {
          status: StoredAssetStatus.DELETE_PENDING,
          cleanupAvailableAt: new Date(),
        },
      },
    );
    if (session) query.session(session);
    return (await query.exec()).modifiedCount;
  },

  async markConversationAssetsForDeletion(conversationId) {
    const query = StoredAssetModel.updateMany(
      { conversationId },
      {
        $set: {
          status: StoredAssetStatus.DELETE_PENDING,
          cleanupAvailableAt: new Date(),
        },
      },
    );
    if (session) query.session(session);
    return (await query.exec()).modifiedCount;
  },

  async markOrganizationAssetsForDeletion(organizationId) {
    const query = StoredAssetModel.updateMany(
      { organizationId },
      {
        $set: {
          status: StoredAssetStatus.DELETE_PENDING,
          cleanupAvailableAt: new Date(),
        },
      },
    );
    if (session) query.session(session);
    return (await query.exec()).modifiedCount;
  },

  async claimNextCleanup(now, leaseUntil) {
    const query = StoredAssetModel.findOneAndUpdate(
      {
        cleanupAvailableAt: { $lte: now },
        $or: [
          {
            status: StoredAssetStatus.DELETE_PENDING,
            $or: [
              { cleanupLeaseUntil: { $exists: false } },
              { cleanupLeaseUntil: { $lte: now } },
            ],
          },
          {
            status: {
              $in: [
                StoredAssetStatus.PENDING,
                StoredAssetStatus.PROMOTING,
                StoredAssetStatus.PROMOTED,
              ],
            },
            expiresAt: { $lte: now },
          },
        ],
      },
      {
        $set: {
          status: StoredAssetStatus.DELETE_PENDING,
          cleanupLeaseUntil: leaseUntil,
        },
        $inc: { cleanupAttempts: 1 },
        $unset: { promotionLeaseUntil: 1 },
      },
      { new: true, sort: { cleanupAvailableAt: 1 } },
    ).lean<StoredAssetDocument>();
    const asset = await query.exec();
    return asset ? toRecord(asset) : null;
  },

  async claimNextStagingCleanup(now, leaseUntil) {
    const query = StoredAssetModel.findOneAndUpdate(
      {
        status: StoredAssetStatus.READY,
        stagingKey: { $exists: true },
        cleanupAvailableAt: { $lte: now },
        $or: [
          { cleanupLeaseUntil: { $exists: false } },
          { cleanupLeaseUntil: { $lte: now } },
        ],
      },
      {
        $set: { cleanupLeaseUntil: leaseUntil },
        $inc: { cleanupAttempts: 1 },
      },
      { new: true, sort: { updatedAt: 1 } },
    ).lean<StoredAssetDocument>();
    const asset = await query.exec();
    return asset ? toRecord(asset) : null;
  },

  async listCleanupCandidates(now, limit) {
    const availableLease = {
      $or: [
        { cleanupLeaseUntil: { $exists: false } },
        { cleanupLeaseUntil: { $lte: now } },
      ],
    };
    const assets = await StoredAssetModel.find({
      cleanupAvailableAt: { $lte: now },
      $or: [
        {
          status: StoredAssetStatus.READY,
          stagingKey: { $exists: true },
          ...availableLease,
        },
        {
          status: StoredAssetStatus.DELETE_PENDING,
          ...availableLease,
        },
        {
          status: {
            $in: [
              StoredAssetStatus.PENDING,
              StoredAssetStatus.PROMOTING,
              StoredAssetStatus.PROMOTED,
            ],
          },
          expiresAt: { $lte: now },
          ...availableLease,
        },
      ],
    })
      .sort({ cleanupAvailableAt: 1, updatedAt: 1 })
      .limit(limit)
      .lean<StoredAssetDocument[]>()
      .exec();

    return assets.map((asset) => ({
      asset: toRecord(asset),
      mode: asset.status === StoredAssetStatus.READY ? "STAGING" : "DELETE",
    }));
  },

  async claimCleanupById(assetId, mode, now, leaseUntil) {
    if (!Types.ObjectId.isValid(assetId)) return null;
    const availableLease = {
      $or: [
        { cleanupLeaseUntil: { $exists: false } },
        { cleanupLeaseUntil: { $lte: now } },
      ],
    };
    const modeFilter =
      mode === "STAGING"
        ? {
            status: StoredAssetStatus.READY,
            stagingKey: { $exists: true },
            ...availableLease,
          }
        : {
            $or: [
              {
                status: StoredAssetStatus.DELETE_PENDING,
                ...availableLease,
              },
              {
                status: {
                  $in: [
                    StoredAssetStatus.PENDING,
                    StoredAssetStatus.PROMOTING,
                    StoredAssetStatus.PROMOTED,
                  ],
                },
                expiresAt: { $lte: now },
                ...availableLease,
              },
            ],
          };
    const asset = await StoredAssetModel.findOneAndUpdate(
      {
        _id: assetId,
        cleanupAvailableAt: { $lte: now },
        ...modeFilter,
      },
      {
        $set: {
          ...(mode === "DELETE"
            ? { status: StoredAssetStatus.DELETE_PENDING }
            : {}),
          cleanupLeaseUntil: leaseUntil,
        },
        $inc: { cleanupAttempts: 1 },
        ...(mode === "DELETE" ? { $unset: { promotionLeaseUntil: 1 } } : {}),
      },
      { new: true },
    )
      .lean<StoredAssetDocument>()
      .exec();
    return asset ? toRecord(asset) : null;
  },

  async completeCleanup(assetId) {
    await StoredAssetModel.deleteOne({
      _id: assetId,
      status: StoredAssetStatus.DELETE_PENDING,
    }).exec();
  },

  async completeStagingCleanup(assetId) {
    await StoredAssetModel.updateOne(
      { _id: assetId, status: StoredAssetStatus.READY },
      { $unset: { stagingKey: 1, cleanupLeaseUntil: 1 } },
    ).exec();
  },

  async scheduleCleanupRetry(assetId, availableAt) {
    await StoredAssetModel.updateOne(
      { _id: assetId },
      {
        $set: { cleanupAvailableAt: availableAt },
        $unset: { cleanupLeaseUntil: 1 },
      },
    ).exec();
  },
});

export interface UploadDailyUsageRepository {
  reserve(
    userId: string,
    dayKey: string,
    bytes: number,
    maximumBytes: number,
    expiresAt: Date,
  ): Promise<boolean>;
}

const isDuplicateKeyError = (error: unknown) =>
  typeof error === "object" &&
  error !== null &&
  "code" in error &&
  error.code === 11000;

export const createMongooseUploadDailyUsageRepository = (
  session?: ClientSession,
): UploadDailyUsageRepository => ({
  async reserve(userId, dayKey, bytes, maximumBytes, expiresAt) {
    if (bytes > maximumBytes) return false;
    const updateExisting = async () => {
      const query = UploadDailyUsageModel.updateOne(
        { userId, dayKey, bytes: { $lte: maximumBytes - bytes } },
        { $inc: { bytes } },
      );
      if (session) query.session(session);
      return (await query.exec()).matchedCount === 1;
    };

    if (await updateExisting()) return true;
    try {
      await UploadDailyUsageModel.create(
        [{ userId, dayKey, bytes, expiresAt }],
        session ? { session } : {},
      );
      return bytes <= maximumBytes;
    } catch (error) {
      if (!isDuplicateKeyError(error)) throw error;
      return updateExisting();
    }
  },
});
