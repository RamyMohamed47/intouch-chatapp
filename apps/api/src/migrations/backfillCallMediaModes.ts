import { pathToFileURL } from "node:url";

import connectDatabase, { disconnectDatabase } from "../config/database.js";
import { loadConfig, loadEnvFile } from "../config/env.js";
import { getLogger } from "../config/logger.js";
import CallSessionModel from "../modules/voice/call.model.js";

export const backfillCallMediaModes = async () =>
  CallSessionModel.updateMany(
    { mediaMode: { $exists: false } },
    { $set: { mediaMode: "AUDIO" } },
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
    const result = await backfillCallMediaModes();
    logger.info(
      { matched: result.matchedCount, modified: result.modifiedCount },
      "Call media-mode migration complete",
    );
    await disconnectDatabase(logger);
  } catch (error) {
    logger.error({ err: error }, "Call media-mode migration failed");
    process.exitCode = 1;
  }
}
