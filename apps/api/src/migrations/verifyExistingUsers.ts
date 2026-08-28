import { pathToFileURL } from "node:url";

import connectDatabase, { disconnectDatabase } from "../config/database.js";
import { loadConfig, loadEnvFile } from "../config/env.js";
import { getLogger } from "../config/logger.js";
import { UserModel } from "../modules/user/user.model.js";
import { EmailVerificationStatus } from "../modules/user/user.types.js";

export const verifyExistingUsers = async () =>
  UserModel.updateMany({ emailVerificationStatus: { $exists: false } }, [
    {
      $set: {
        emailVerificationStatus: EmailVerificationStatus.VERIFIED,
        emailVerifiedAt: { $ifNull: ["$emailVerifiedAt", "$createdAt"] },
      },
    },
  ]).exec();

const isDirectExecution =
  process.argv[1] !== undefined &&
  import.meta.url === pathToFileURL(process.argv[1]).href;

if (isDirectExecution) {
  loadEnvFile();
  const logger = getLogger();
  try {
    const config = loadConfig();
    await connectDatabase(config.databaseUri, logger);
    const result = await verifyExistingUsers();
    logger.info(
      { matched: result.matchedCount, modified: result.modifiedCount },
      "Existing user email verification migration complete",
    );
    await disconnectDatabase(logger);
  } catch (error) {
    logger.error({ err: error }, "Existing user verification migration failed");
    process.exitCode = 1;
  }
}
