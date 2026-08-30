import assert from "node:assert/strict";
import { describe, test } from "node:test";

import { AttachmentKind, UploadPurpose } from "@intouch/shared/uploads";
import pino from "pino";

import type { OrganizationRepository } from "../src/modules/organizations/organization.repository.js";
import type { AvatarUserRepository } from "../src/modules/user/user.repository.js";
import {
  OrganizationStorageLimitError,
  UploadQuotaExceededError,
} from "../src/modules/uploads/upload.errors.js";
import type {
  StoredAssetRepository,
  UploadDailyUsageRepository,
} from "../src/modules/uploads/upload.repository.js";
import { createUploadService } from "../src/modules/uploads/upload.service.js";
import {
  StoredAssetModel,
  UploadDailyUsageModel,
} from "../src/modules/uploads/upload.model.js";
import type {
  ObjectStorage,
  StoredAssetRecord,
} from "../src/modules/uploads/upload.types.js";
import { StoredAssetStatus } from "../src/modules/uploads/upload.types.js";
import type {
  UploadUnitOfWork,
  UploadWorkContext,
} from "../src/modules/uploads/upload.unit-of-work.js";
import { createAssetCleanupWorker } from "../src/modules/uploads/upload.worker.js";

const userId = "507f1f77bcf86cd799439011";
const organizationId = "507f1f77bcf86cd799439012";
const conversationId = "507f1f77bcf86cd799439013";
const uploadId = "507f1f77bcf86cd799439014";
const fixedNow = new Date("2026-08-30T12:00:00.000Z");
const png = Uint8Array.from(
  Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
    "base64",
  ),
);

const baseAsset: StoredAssetRecord = {
  id: uploadId,
  ownerUserId: userId,
  organizationId,
  conversationId,
  purpose: UploadPurpose.MESSAGE_ATTACHMENT,
  status: StoredAssetStatus.PENDING,
  stagingKey: `staging/${userId}/random-id`,
  objectKey: `organizations/${organizationId}/conversations/${conversationId}/random-id`,
  fileName: "image.png",
  declaredContentType: "image/png",
  declaredSize: png.length,
  expiresAt: new Date(fixedNow.getTime() + 60 * 60 * 1000),
  cleanupAttempts: 0,
  cleanupAvailableAt: fixedNow,
  createdAt: fixedNow,
  updatedAt: fixedNow,
};

const createAssetRepository = (
  overrides: Partial<StoredAssetRepository> = {},
): StoredAssetRepository => ({
  createMany: async () => [],
  findById: async () => null,
  findReadyById: async () => null,
  listReadyByMessageIds: async () => [],
  countPendingByOwner: async () => 0,
  sumActiveBytesByOrganization: async () => 0,
  claimForPromotion: async () => null,
  markPromoted: async () => null,
  releasePromotion: async () => undefined,
  markDeletePending: async () => false,
  markClaimedForDeletion: async () => false,
  claimForMessage: async () => [],
  claimAvatar: async () => null,
  markMessageAssetsForDeletion: async () => 0,
  markConversationAssetsForDeletion: async () => 0,
  markOrganizationAssetsForDeletion: async () => 0,
  claimNextCleanup: async () => null,
  claimNextStagingCleanup: async () => null,
  completeCleanup: async () => undefined,
  completeStagingCleanup: async () => undefined,
  scheduleCleanupRetry: async () => undefined,
  ...overrides,
});

const createOrganizationRepository = (): OrganizationRepository => ({
  create: async () => {
    throw new Error("unused");
  },
  findById: async () => null,
  findByIds: async () => [],
  lockForMutation: async () => true,
  updateById: async () => null,
  deleteById: async () => false,
});

const createStorage = (
  overrides: Partial<ObjectStorage> = {},
): ObjectStorage => ({
  createUploadUrl: async (key) => `https://storage.example.test/${key}`,
  inspect: async () => null,
  promote: async () => undefined,
  createAccessUrl: async (key) => `https://storage.example.test/${key}`,
  deleteObjects: async () => undefined,
  ...overrides,
});

const createUnitOfWork = (
  assets: StoredAssetRepository,
  usage: UploadDailyUsageRepository,
): UploadUnitOfWork => {
  const users: AvatarUserRepository = {
    replaceAvatarAsset: async () => null,
  };
  const context: UploadWorkContext = {
    assets,
    usage,
    organizations: createOrganizationRepository(),
    users,
  };
  return { run: (work) => work(context) };
};

const createService = (input: {
  assets: StoredAssetRepository;
  usage?: UploadDailyUsageRepository;
  storage?: ObjectStorage;
  dailyUserBytes?: number;
  organizationStorageBytes?: number;
  onConversationAccess?: () => void;
}) => {
  const usage = input.usage ?? { reserve: async () => true };
  return createUploadService({
    assets: input.assets,
    conversations: {
      getAccessible: async () => {
        input.onConversationAccess?.();
        return {
          id: conversationId,
          organizationId,
          type: "CHANNEL",
          categoryId: "507f1f77bcf86cd799439015",
          name: "general",
          visibility: "PUBLIC",
          position: 0,
          createdAt: fixedNow,
          updatedAt: fixedNow,
        };
      },
    },
    storage: input.storage ?? createStorage(),
    unitOfWork: createUnitOfWork(input.assets, usage),
    dailyUserBytes: input.dailyUserBytes ?? 500 * 1024 * 1024,
    organizationStorageBytes:
      input.organizationStorageBytes ?? 5 * 1024 * 1024 * 1024,
    now: () => fixedNow,
  });
};

describe("upload service", () => {
  test("reserves quota and returns content-type-bound upload tickets", async () => {
    let reservedBytes = 0;
    const createdAssets: StoredAssetRecord[] = [];
    const assets = createAssetRepository({
      createMany: async (inputs) =>
        inputs.map((input, index) => {
          const record: StoredAssetRecord = {
            id: `507f1f77bcf86cd79943902${index}`,
            ownerUserId: input.ownerUserId,
            ...(input.organizationId
              ? { organizationId: input.organizationId }
              : {}),
            ...(input.conversationId
              ? { conversationId: input.conversationId }
              : {}),
            purpose: input.purpose,
            status: StoredAssetStatus.PENDING,
            stagingKey: input.stagingKey,
            objectKey: input.objectKey,
            fileName: input.fileName,
            declaredContentType: input.contentType,
            declaredSize: input.size,
            expiresAt: input.expiresAt,
            cleanupAttempts: 0,
            cleanupAvailableAt: fixedNow,
            createdAt: fixedNow,
            updatedAt: fixedNow,
          };
          createdAssets.push(record);
          return record;
        }),
    });
    const service = createService({
      assets,
      usage: {
        reserve: async (_userId, _dayKey, bytes) => {
          reservedBytes = bytes;
          return true;
        },
      },
    });

    const result = await service.create(userId, {
      purpose: UploadPurpose.MESSAGE_ATTACHMENT,
      conversationId,
      files: [
        { fileName: " image.png ", contentType: "image/png", size: 8 },
        { fileName: "report.pdf", contentType: "application/pdf", size: 12 },
      ],
    });

    assert.equal(reservedBytes, 20);
    assert.equal(createdAssets.length, 2);
    assert.equal(createdAssets[0]?.fileName, "image.png");
    assert.equal(result.uploadTickets.length, 2);
    assert.deepEqual(result.uploadTickets[0]?.headers, {
      "Content-Type": "image/png",
    });
    assert.equal(
      result.uploadTickets[0]?.expiresAt.toISOString(),
      "2026-08-30T12:05:00.000Z",
    );
    assert.equal(
      result.uploadTickets[0]?.uploadUrl.includes("image.png"),
      false,
    );
  });

  test("enforces daily and organization quotas before issuing URLs", async () => {
    const assets = createAssetRepository({
      sumActiveBytesByOrganization: async () => 90,
    });
    await assert.rejects(
      createService({
        assets,
        organizationStorageBytes: 100,
      }).create(userId, {
        purpose: UploadPurpose.MESSAGE_ATTACHMENT,
        conversationId,
        files: [{ fileName: "image.png", contentType: "image/png", size: 20 }],
      }),
      OrganizationStorageLimitError,
    );
    await assert.rejects(
      createService({
        assets: createAssetRepository(),
        usage: { reserve: async () => false },
      }).create(userId, {
        purpose: UploadPurpose.AVATAR,
        files: [{ fileName: "avatar.png", contentType: "image/png", size: 8 }],
      }),
      UploadQuotaExceededError,
    );
  });

  test("verifies, conditionally promotes, and idempotently completes uploads", async () => {
    let promotions = 0;
    let promotedAsset: StoredAssetRecord | null = null;
    const assets = createAssetRepository({
      findById: async () => promotedAsset ?? baseAsset,
      claimForPromotion: async () => ({
        ...baseAsset,
        status: StoredAssetStatus.PROMOTING,
      }),
      markPromoted: async (_assetId, _ownerUserId, verified) => {
        promotedAsset = {
          ...baseAsset,
          status: StoredAssetStatus.PROMOTED,
          etag: verified.etag,
          kind: verified.kind,
          verifiedContentType: verified.contentType,
          verifiedSize: verified.size,
        };
        return promotedAsset;
      },
    });
    const service = createService({
      assets,
      storage: createStorage({
        inspect: async () => ({
          contentType: "image/png",
          size: png.length,
          etag: '"observed-etag"',
          prefix: png,
        }),
        promote: async (input) => {
          promotions += 1;
          assert.equal(input.etag, '"observed-etag"');
          assert.equal(input.sourceKey, baseAsset.stagingKey);
          assert.equal(input.destinationKey, baseAsset.objectKey);
        },
      }),
    });

    const first = await service.complete(userId, uploadId);
    const second = await service.complete(userId, uploadId);
    assert.equal(promotions, 1);
    assert.deepEqual(second, first);
    assert.equal(first.kind, AttachmentKind.IMAGE);
    assert.equal("objectKey" in first, false);
  });

  test("authorizes message assets before issuing short-lived read URLs", async () => {
    let accessChecks = 0;
    const assets = createAssetRepository({
      findReadyById: async () => ({
        ...baseAsset,
        status: StoredAssetStatus.READY,
        kind: AttachmentKind.IMAGE,
        verifiedContentType: "image/png",
        verifiedSize: png.length,
      }),
    });
    const result = await createService({
      assets,
      onConversationAccess: () => {
        accessChecks += 1;
      },
    }).access(userId, uploadId);

    assert.equal(accessChecks, 1);
    assert.equal(result.accessUrl.endsWith(baseAsset.objectKey), true);
    assert.equal(result.expiresAt.toISOString(), "2026-08-30T12:10:00.000Z");
  });
});

describe("stored asset lifecycle", () => {
  test("declares ownership, cleanup, usage uniqueness, and TTL indexes", () => {
    const assetIndexes = StoredAssetModel.schema.indexes();
    assert.equal(
      assetIndexes.some(
        ([fields, options]) =>
          fields.ownerUserId === 1 &&
          fields.status === 1 &&
          options.name === "assets_by_owner_status",
      ),
      true,
    );
    assert.equal(
      assetIndexes.some(
        ([fields, options]) =>
          fields.status === 1 &&
          fields.expiresAt === 1 &&
          options.name === "asset_cleanup_candidates",
      ),
      true,
    );
    const usageIndexes = UploadDailyUsageModel.schema.indexes();
    assert.equal(
      usageIndexes.some(
        ([fields, options]) =>
          fields.userId === 1 && fields.dayKey === 1 && options.unique === true,
      ),
      true,
    );
    assert.equal(
      usageIndexes.some(
        ([fields, options]) =>
          fields.expiresAt === 1 && options.expireAfterSeconds === 0,
      ),
      true,
    );
  });

  test("removes staging objects after claims and retries failed deletion", async () => {
    let stagingCompleted = false;
    const deletedKeys: string[][] = [];
    const stagingRepository = createAssetRepository({
      claimNextStagingCleanup: async () => ({
        ...baseAsset,
        status: StoredAssetStatus.READY,
      }),
      completeStagingCleanup: async () => {
        stagingCompleted = true;
      },
    });
    const worker = createAssetCleanupWorker({
      assets: stagingRepository,
      storage: createStorage({
        deleteObjects: async (keys) => {
          deletedKeys.push([...keys]);
        },
      }),
      logger: pino({ enabled: false }),
      now: () => fixedNow,
    });
    assert.equal(await worker.runOnce(), true);
    assert.equal(stagingCompleted, true);
    assert.deepEqual(deletedKeys, [[baseAsset.stagingKey]]);

    let retryAtMs = 0;
    const failingWorker = createAssetCleanupWorker({
      assets: createAssetRepository({
        claimNextCleanup: async () => ({
          ...baseAsset,
          status: StoredAssetStatus.DELETE_PENDING,
          cleanupAttempts: 2,
        }),
        scheduleCleanupRetry: async (_assetId, availableAt) => {
          retryAtMs = availableAt.getTime();
        },
      }),
      storage: createStorage({
        deleteObjects: async () => {
          throw new Error("storage unavailable");
        },
      }),
      logger: pino({ enabled: false }),
      now: () => fixedNow,
    });
    assert.equal(await failingWorker.runOnce(), true);
    assert.equal(retryAtMs, fixedNow.getTime() + 4_000);
  });
});
