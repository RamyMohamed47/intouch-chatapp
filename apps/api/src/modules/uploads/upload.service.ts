import { randomUUID } from "node:crypto";
import {
  UploadPurpose,
  type AttachmentDto,
  type CompletedUploadDto,
  type CreateUploadInput,
} from "@intouch/shared/uploads";

import type { ConversationService } from "../conversations/index.js";
import {
  OrganizationStorageLimitError,
  UploadConflictError,
  UploadNotFoundError,
  UploadQuotaExceededError,
  UploadValidationError,
} from "./upload.errors.js";
import type { StoredAssetRepository } from "./upload.repository.js";
import type { ObjectStorage, StoredAssetRecord } from "./upload.types.js";
import { StoredAssetStatus } from "./upload.types.js";
import type { UploadUnitOfWork } from "./upload.unit-of-work.js";
import {
  contentDispositionFor,
  inspectUploadedFile,
  sanitizeFileName,
  validateDeclaredFile,
} from "./upload.validation.js";

const UPLOAD_URL_SECONDS = 5 * 60;
const ACCESS_URL_SECONDS = 10 * 60;
const PENDING_LIFETIME_MS = 60 * 60 * 1000;
const PROMOTION_LEASE_MS = 60 * 1000;
const MAX_PENDING_UPLOADS = 10;

const toAttachment = (asset: StoredAssetRecord): AttachmentDto => {
  if (!asset.kind || !asset.verifiedContentType || !asset.verifiedSize) {
    throw new UploadConflictError("Upload has not been verified");
  }
  return {
    id: asset.id,
    fileName: asset.fileName,
    contentType: asset.verifiedContentType,
    size: asset.verifiedSize,
    kind: asset.kind,
    createdAt: asset.createdAt.toISOString(),
  };
};

const toCompletedUpload = (asset: StoredAssetRecord): CompletedUploadDto => ({
  ...toAttachment(asset),
  uploadId: asset.id,
});

const nextUtcDay = (now: Date) =>
  new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1),
  );

export interface UploadServiceDependencies {
  assets: StoredAssetRepository;
  conversations: Pick<ConversationService, "getAccessible">;
  storage: ObjectStorage;
  unitOfWork: UploadUnitOfWork;
  dailyUserBytes: number;
  organizationStorageBytes: number;
  now?: () => Date;
}

export const createUploadService = ({
  assets,
  conversations,
  storage,
  unitOfWork,
  dailyUserBytes,
  organizationStorageBytes,
  now = () => new Date(),
}: UploadServiceDependencies) => ({
  async create(userId: string, input: CreateUploadInput) {
    const requestedAt = now();
    const conversation =
      input.purpose === UploadPurpose.MESSAGE_ATTACHMENT
        ? await conversations.getAccessible(userId, input.conversationId)
        : null;
    const files = input.files.map((file) => {
      const fileName = sanitizeFileName(file.fileName);
      validateDeclaredFile(
        input.purpose,
        fileName,
        file.contentType,
        file.size,
      );
      return { ...file, fileName };
    });
    const requestedBytes = files.reduce((sum, file) => sum + file.size, 0);
    const expiresAt = new Date(requestedAt.getTime() + PENDING_LIFETIME_MS);
    const created = await unitOfWork.run(async (context) => {
      if (
        (await context.assets.countPendingByOwner(userId)) + files.length >
        MAX_PENDING_UPLOADS
      ) {
        throw new UploadConflictError("Too many unfinished uploads");
      }
      if (conversation) {
        if (
          !(await context.organizations.lockForMutation(
            conversation.organizationId,
          ))
        ) {
          throw new UploadNotFoundError();
        }
        const activeBytes = await context.assets.sumActiveBytesByOrganization(
          conversation.organizationId,
        );
        if (activeBytes + requestedBytes > organizationStorageBytes) {
          throw new OrganizationStorageLimitError();
        }
      }

      const dayKey = requestedAt.toISOString().slice(0, 10);
      const usageExpiresAt = new Date(
        nextUtcDay(requestedAt).getTime() + 24 * 60 * 60 * 1000,
      );
      if (
        !(await context.usage.reserve(
          userId,
          dayKey,
          requestedBytes,
          dailyUserBytes,
          usageExpiresAt,
        ))
      ) {
        const retryAfterSeconds = Math.max(
          1,
          Math.ceil(
            (nextUtcDay(requestedAt).getTime() - requestedAt.getTime()) / 1000,
          ),
        );
        throw new UploadQuotaExceededError(retryAfterSeconds);
      }

      return context.assets.createMany(
        files.map((file) => {
          const objectId = randomUUID();
          return {
            ownerUserId: userId,
            ...(conversation
              ? {
                  organizationId: conversation.organizationId,
                  conversationId: conversation.id,
                }
              : {}),
            purpose: input.purpose,
            stagingKey: `staging/${userId}/${objectId}`,
            objectKey: conversation
              ? `organizations/${conversation.organizationId}/conversations/${conversation.id}/${objectId}`
              : `avatars/${userId}/${objectId}`,
            fileName: file.fileName,
            contentType: file.contentType,
            size: file.size,
            expiresAt,
          };
        }),
      );
    });

    try {
      const uploadTickets = await Promise.all(
        created.map(async (asset) => {
          if (!asset.stagingKey) throw new UploadConflictError();
          return {
            uploadId: asset.id,
            uploadUrl: await storage.createUploadUrl(
              asset.stagingKey,
              asset.declaredContentType,
              UPLOAD_URL_SECONDS,
            ),
            headers: { "Content-Type": asset.declaredContentType },
            expiresAt: new Date(
              requestedAt.getTime() + UPLOAD_URL_SECONDS * 1000,
            ),
          };
        }),
      );
      return { uploadTickets };
    } catch (error) {
      await Promise.all(
        created.map((asset) => assets.markDeletePending(asset.id, userId)),
      );
      throw error;
    }
  },

  async complete(userId: string, uploadId: string) {
    const existing = await assets.findById(uploadId);
    if (!existing || existing.ownerUserId !== userId)
      throw new UploadNotFoundError();
    if (
      existing.status === StoredAssetStatus.PROMOTED ||
      existing.status === StoredAssetStatus.READY
    ) {
      return toCompletedUpload(existing);
    }
    const claimed = await assets.claimForPromotion(
      uploadId,
      userId,
      now(),
      new Date(now().getTime() + PROMOTION_LEASE_MS),
    );
    if (!claimed?.stagingKey) throw new UploadConflictError();

    try {
      const object = await storage.inspect(claimed.stagingKey);
      if (!object) {
        await assets.releasePromotion(uploadId, userId);
        throw new UploadConflictError("Upload has not reached storage yet");
      }
      const verified = await inspectUploadedFile({
        purpose: claimed.purpose,
        fileName: claimed.fileName,
        declaredContentType: claimed.declaredContentType,
        declaredSize: claimed.declaredSize,
        object,
      });
      await storage.promote({
        sourceKey: claimed.stagingKey,
        destinationKey: claimed.objectKey,
        etag: object.etag,
        contentType: verified.contentType,
        contentDisposition: contentDispositionFor(
          claimed.fileName,
          verified.kind,
        ),
      });
      const promoted = await assets.markPromoted(uploadId, userId, {
        etag: object.etag,
        ...verified,
      });
      if (!promoted) throw new UploadConflictError();
      return toCompletedUpload(promoted);
    } catch (error) {
      if (error instanceof UploadValidationError) {
        await assets.markDeletePending(uploadId, userId);
      } else if (!(error instanceof UploadConflictError)) {
        await assets.releasePromotion(uploadId, userId);
      }
      throw error;
    }
  },

  async cancel(userId: string, uploadId: string) {
    const existing = await assets.findById(uploadId);
    if (!existing || existing.ownerUserId !== userId) return;
    if (existing.status === StoredAssetStatus.READY) {
      throw new UploadConflictError("A claimed upload cannot be canceled");
    }
    await assets.markDeletePending(uploadId, userId);
  },

  async access(userId: string, assetId: string) {
    const asset = await assets.findReadyById(assetId);
    if (!asset) throw new UploadNotFoundError();
    if (asset.purpose === UploadPurpose.MESSAGE_ATTACHMENT) {
      if (!asset.conversationId) throw new UploadNotFoundError();
      await conversations.getAccessible(userId, asset.conversationId);
    }
    const issuedAt = now();
    return {
      accessUrl: await storage.createAccessUrl(
        asset.objectKey,
        ACCESS_URL_SECONDS,
      ),
      expiresAt: new Date(issuedAt.getTime() + ACCESS_URL_SECONDS * 1000),
    };
  },

  async setAvatar(userId: string, uploadId: string) {
    return unitOfWork.run(async (context) => {
      const claimed = await context.assets.claimAvatar(uploadId, userId, now());
      if (!claimed) throw new UploadConflictError();
      const updated = await context.users.replaceAvatarAsset(
        userId,
        claimed.id,
      );
      if (!updated) throw new UploadNotFoundError();
      if (
        updated.previousAvatarAssetId &&
        updated.previousAvatarAssetId !== claimed.id
      ) {
        await context.assets.markClaimedForDeletion(
          updated.previousAvatarAssetId,
        );
      }
      return updated.user;
    });
  },

  async removeAvatar(userId: string) {
    return unitOfWork.run(async (context) => {
      const updated = await context.users.replaceAvatarAsset(userId, null);
      if (!updated) throw new UploadNotFoundError();
      if (updated.previousAvatarAssetId) {
        await context.assets.markClaimedForDeletion(
          updated.previousAvatarAssetId,
        );
      }
      return updated.user;
    });
  },

  async decorate<T extends { id: string }>(records: readonly T[]) {
    const attachments = await assets.listReadyByMessageIds(
      records.map(({ id }) => id),
    );
    const byMessage = new Map<string, AttachmentDto[]>();
    for (const asset of attachments) {
      if (!asset.messageId) continue;
      const current = byMessage.get(asset.messageId) ?? [];
      current.push(toAttachment(asset));
      byMessage.set(asset.messageId, current);
    }
    return records.map((record) => ({
      ...record,
      attachments: byMessage.get(record.id) ?? [],
    }));
  },
});

export type UploadService = ReturnType<typeof createUploadService>;
