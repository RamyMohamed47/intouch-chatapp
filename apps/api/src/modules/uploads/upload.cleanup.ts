import type { Logger } from "pino";

import type { StoredAssetRepository } from "./upload.repository.js";
import type {
  AssetCleanupModeValue,
  ObjectStorage,
  StoredAssetRecord,
} from "./upload.types.js";

export const ASSET_CLEANUP_LEASE_MS = 60_000;
export const ASSET_CLEANUP_BULL_ATTEMPTS = 3;

export const getAssetCleanupRetryDelay = (cleanupAttempts: number) =>
  Math.min(60 * 60 * 1000, 2 ** Math.min(cleanupAttempts, 10) * 1_000);

export const getAssetCleanupErrorCode = (error: unknown) => {
  if (typeof error === "object" && error !== null && "code" in error) {
    const code = error.code;
    if (typeof code === "string") return code.slice(0, 80);
  }
  return "ASSET_CLEANUP_FAILED";
};

export const performClaimedAssetCleanup = async (
  dependencies: {
    assets: StoredAssetRepository;
    storage: ObjectStorage;
    logger: Logger;
  },
  asset: StoredAssetRecord,
  mode: AssetCleanupModeValue,
) => {
  if (mode === "STAGING") {
    if (asset.stagingKey) {
      await dependencies.storage.deleteObjects([asset.stagingKey]);
    }
    await dependencies.assets.completeStagingCleanup(asset.id);
    return;
  }

  await dependencies.storage.deleteObjects(
    [asset.stagingKey, asset.objectKey].filter(
      (key): key is string => key !== undefined,
    ),
  );
  await dependencies.assets.completeCleanup(asset.id);
};
