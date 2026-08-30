import type { Logger } from "pino";

import type { StoredAssetRepository } from "./upload.repository.js";
import type { ObjectStorage, StoredAssetRecord } from "./upload.types.js";
import {
  ASSET_CLEANUP_LEASE_MS,
  getAssetCleanupErrorCode,
  getAssetCleanupRetryDelay,
  performClaimedAssetCleanup,
} from "./upload.cleanup.js";

const POLL_INTERVAL_MS = 5_000;

export interface AssetCleanupWorker {
  start(): void;
  close(): Promise<void>;
  runOnce(): Promise<boolean>;
}

export const createAssetCleanupWorker = (dependencies: {
  assets: StoredAssetRepository;
  storage: ObjectStorage;
  logger: Logger;
  now?: () => Date;
}): AssetCleanupWorker => {
  const now = dependencies.now ?? (() => new Date());
  let timer: ReturnType<typeof setInterval> | undefined;
  let running: Promise<void> | undefined;

  const retry = async (asset: StoredAssetRecord, error: unknown) => {
    const delay = getAssetCleanupRetryDelay(asset.cleanupAttempts);
    await dependencies.assets.scheduleCleanupRetry(
      asset.id,
      new Date(now().getTime() + delay),
    );
    dependencies.logger.warn(
      {
        errorCode: getAssetCleanupErrorCode(error),
        assetId: asset.id,
        purpose: asset.purpose,
        attempt: asset.cleanupAttempts,
      },
      "Stored asset cleanup failed",
    );
  };

  const runOnce = async () => {
    const claimedAt = now();
    const leaseUntil = new Date(claimedAt.getTime() + ASSET_CLEANUP_LEASE_MS);
    const staging = await dependencies.assets.claimNextStagingCleanup(
      claimedAt,
      leaseUntil,
    );
    if (staging?.stagingKey) {
      try {
        await performClaimedAssetCleanup(dependencies, staging, "STAGING");
      } catch (error) {
        await retry(staging, error);
      }
      return true;
    }

    const asset = await dependencies.assets.claimNextCleanup(
      claimedAt,
      leaseUntil,
    );
    if (!asset) return false;
    try {
      await performClaimedAssetCleanup(dependencies, asset, "DELETE");
    } catch (error) {
      await retry(asset, error);
    }
    return true;
  };

  const pump = async () => {
    if (running) return running;
    running = (async () => {
      try {
        for (let processed = 0; processed < 20; processed += 1) {
          if (!(await runOnce())) break;
        }
      } catch (error) {
        dependencies.logger.warn(
          { err: error },
          "Asset cleanup iteration failed",
        );
      } finally {
        running = undefined;
      }
    })();
    return running;
  };

  return {
    runOnce,
    start() {
      if (timer) return;
      void pump();
      timer = setInterval(() => void pump(), POLL_INTERVAL_MS);
      timer.unref();
    },
    async close() {
      if (timer) clearInterval(timer);
      timer = undefined;
      await running;
    },
  };
};
