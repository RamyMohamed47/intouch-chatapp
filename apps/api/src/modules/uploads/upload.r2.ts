import {
  CopyObjectCommand,
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

import { StorageUnavailableError } from "./upload.errors.js";
import type { InspectedObject, ObjectStorage } from "./upload.types.js";

const FULL_INSPECTION_TYPES = new Set([
  "text/plain",
  "text/csv",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
]);
const BINARY_PREFIX_BYTES = 64 * 1024;

export interface R2StorageConfig {
  accountId: string;
  accessKeyId: string;
  secretAccessKey: string;
  bucketName: string;
}

const asStorageError = (error: unknown) =>
  error instanceof StorageUnavailableError
    ? error
    : new StorageUnavailableError({ cause: error });

export const createR2ObjectStorage = (
  config: R2StorageConfig,
): ObjectStorage => {
  const client = new S3Client({
    region: "auto",
    endpoint: `https://${config.accountId}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: config.accessKeyId,
      secretAccessKey: config.secretAccessKey,
    },
  });

  return {
    async createUploadUrl(key, contentType, expiresInSeconds) {
      try {
        return await getSignedUrl(
          client,
          new PutObjectCommand({
            Bucket: config.bucketName,
            Key: key,
            ContentType: contentType,
          }),
          { expiresIn: expiresInSeconds },
        );
      } catch (error) {
        throw asStorageError(error);
      }
    },

    async inspect(key): Promise<InspectedObject | null> {
      try {
        const head = await client.send(
          new HeadObjectCommand({ Bucket: config.bucketName, Key: key }),
        );
        if (
          head.ContentLength === undefined ||
          !head.ContentType ||
          !head.ETag
        ) {
          return null;
        }
        if (head.ContentLength === 0) {
          return {
            contentType: head.ContentType,
            size: 0,
            etag: head.ETag,
            prefix: new Uint8Array(),
          };
        }
        const inspectedBytes = FULL_INSPECTION_TYPES.has(head.ContentType)
          ? head.ContentLength
          : Math.min(head.ContentLength, BINARY_PREFIX_BYTES);
        const object = await client.send(
          new GetObjectCommand({
            Bucket: config.bucketName,
            Key: key,
            Range: `bytes=0-${inspectedBytes - 1}`,
            IfMatch: head.ETag,
          }),
        );
        if (!object.Body) return null;
        return {
          contentType: head.ContentType,
          size: head.ContentLength,
          etag: head.ETag,
          prefix: await object.Body.transformToByteArray(),
        };
      } catch (error) {
        if (
          typeof error === "object" &&
          error !== null &&
          "$metadata" in error &&
          (error as { $metadata?: { httpStatusCode?: number } }).$metadata
            ?.httpStatusCode === 404
        ) {
          return null;
        }
        throw asStorageError(error);
      }
    },

    async promote(input) {
      try {
        await client.send(
          new CopyObjectCommand({
            Bucket: config.bucketName,
            Key: input.destinationKey,
            CopySource: `${config.bucketName}/${input.sourceKey}`,
            CopySourceIfMatch: input.etag,
            MetadataDirective: "REPLACE",
            ContentType: input.contentType,
            ContentDisposition: input.contentDisposition,
            CacheControl: "private, max-age=600",
          }),
        );
      } catch (error) {
        throw asStorageError(error);
      }
    },

    async createAccessUrl(key, expiresInSeconds) {
      try {
        return await getSignedUrl(
          client,
          new GetObjectCommand({ Bucket: config.bucketName, Key: key }),
          { expiresIn: expiresInSeconds },
        );
      } catch (error) {
        throw asStorageError(error);
      }
    },

    async deleteObjects(keys) {
      try {
        await Promise.all(
          [...new Set(keys)].map((key) =>
            client.send(
              new DeleteObjectCommand({ Bucket: config.bucketName, Key: key }),
            ),
          ),
        );
      } catch (error) {
        throw asStorageError(error);
      }
    },
  };
};

export const createDisabledObjectStorage = (): ObjectStorage => {
  const unavailable = () => {
    throw new StorageUnavailableError();
  };
  return {
    createUploadUrl: unavailable,
    inspect: unavailable,
    promote: unavailable,
    createAccessUrl: unavailable,
    deleteObjects: unavailable,
  };
};
