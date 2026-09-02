import { pathToFileURL } from "node:url";

import connectDatabase, { disconnectDatabase } from "../config/database.js";
import { loadConfig, loadEnvFile } from "../config/env.js";
import { getLogger } from "../config/logger.js";
import ConversationModel from "../modules/conversations/conversation.model.js";

export const backfillChannelKinds = async () =>
  ConversationModel.updateMany(
    { type: "CHANNEL", kind: { $exists: false } },
    { $set: { kind: "TEXT" } },
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
    const result = await backfillChannelKinds();
    logger.info(
      { matched: result.matchedCount, modified: result.modifiedCount },
      "Channel kind migration complete",
    );
    await disconnectDatabase(logger);
  } catch (error) {
    logger.error({ err: error }, "Channel kind migration failed");
    process.exitCode = 1;
  }
}
