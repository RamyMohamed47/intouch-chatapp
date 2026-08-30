import type { Logger } from "pino";

import type { StoredAssetRepository } from "./upload.repository.js";
import type { ObjectStorage, StoredAssetRecord } from "./upload.types.js";

const POLL_INTERVAL_MS = 5_000;
const LEASE_MS = 60_000;

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
    const delay = Math.min(
      60 * 60 * 1000,
      2 ** Math.min(asset.cleanupAttempts, 10) * 1000,
    );
    await dependencies.assets.scheduleCleanupRetry(
      asset.id,
      new Date(now().getTime() + delay),
    );
    dependencies.logger.warn(
      {
        err: error,
        assetId: asset.id,
        purpose: asset.purpose,
        attempt: asset.cleanupAttempts,
      },
      "Stored asset cleanup failed",
    );
  };

  const runOnce = async () => {
    const claimedAt = now();
    const leaseUntil = new Date(claimedAt.getTime() + LEASE_MS);
    const staging = await dependencies.assets.claimNextStagingCleanup(
      claimedAt,
      leaseUntil,
    );
    if (staging?.stagingKey) {
      try {
        await dependencies.storage.deleteObjects([staging.stagingKey]);
        await dependencies.assets.completeStagingCleanup(staging.id);
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
      await dependencies.storage.deleteObjects(
        [asset.stagingKey, asset.objectKey].filter(
          (key): key is string => key !== undefined,
        ),
      );
      await dependencies.assets.completeCleanup(asset.id);
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
