import { pathToFileURL } from "node:url";

import connectDatabase, { disconnectDatabase } from "../config/database.js";
import { loadConfig, loadEnvFile } from "../config/env.js";
import { getLogger } from "../config/logger.js";
import { UserModel } from "../modules/user/user.model.js";

export const removeLegacyUserStatus = async () =>
  UserModel.updateMany(
    { status: { $exists: true } },
    { $unset: { status: "" } },
  ).exec();

const isDirectExecution =
  process.argv[1] !== undefined &&
  import.meta.url === pathToFileURL(process.argv[1]).href;

if (isDirectExecution) {
  loadEnvFile();
  const logger = getLogger();
  try {
    const config = loadConfig();
    await connectDatabase(config.databaseUri, logger);
    const result = await removeLegacyUserStatus();
    logger.info(
      { matched: result.matchedCount, modified: result.modifiedCount },
      "Legacy user status cleanup complete",
    );
    await disconnectDatabase(logger);
  } catch (error) {
    logger.error({ err: error }, "Legacy user status cleanup failed");
    process.exitCode = 1;
  }
}
