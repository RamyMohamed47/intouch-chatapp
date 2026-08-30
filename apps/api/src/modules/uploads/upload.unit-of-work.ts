import mongoose from "mongoose";

import {
  createMongooseOrganizationRepository,
  type OrganizationRepository,
} from "../organizations/index.js";
import {
  createMongooseStoredAssetRepository,
  createMongooseUploadDailyUsageRepository,
  type StoredAssetRepository,
  type UploadDailyUsageRepository,
} from "./upload.repository.js";
import createMongooseUserRepository, {
  type AvatarUserRepository,
} from "../user/user.repository.js";

export interface UploadWorkContext {
  assets: StoredAssetRepository;
  organizations: OrganizationRepository;
  usage: UploadDailyUsageRepository;
  users: AvatarUserRepository;
}

export interface UploadUnitOfWork {
  run<T>(work: (context: UploadWorkContext) => Promise<T>): Promise<T>;
}

export const createMongooseUploadUnitOfWork = (): UploadUnitOfWork => ({
  run(work) {
    return mongoose.connection.transaction((session) =>
      work({
        assets: createMongooseStoredAssetRepository(session),
        organizations: createMongooseOrganizationRepository(session),
        usage: createMongooseUploadDailyUsageRepository(session),
        users: createMongooseUserRepository(session),
      }),
    );
  },
});
