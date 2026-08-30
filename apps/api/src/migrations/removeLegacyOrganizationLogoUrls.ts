import { pathToFileURL } from "node:url";

import connectDatabase, { disconnectDatabase } from "../config/database.js";
import { loadConfig, loadEnvFile } from "../config/env.js";
import { getLogger } from "../config/logger.js";
import OrganizationModel from "../modules/organizations/organization.model.js";

export const removeLegacyOrganizationLogoUrls = async () =>
  OrganizationModel.collection.updateMany(
    { logoUrl: { $exists: true } },
    { $unset: { logoUrl: "" } },
  );

const isDirectExecution =
  process.argv[1] !== undefined &&
  import.meta.url === pathToFileURL(process.argv[1]).href;

if (isDirectExecution) {
  loadEnvFile();
  const logger = getLogger();
  try {
    const config = loadConfig();
    await connectDatabase(config.databaseUri, logger);
    const result = await removeLegacyOrganizationLogoUrls();
    logger.info(
      { matched: result.matchedCount, modified: result.modifiedCount },
      "Legacy organization logo URL cleanup complete",
    );
    await disconnectDatabase(logger);
  } catch (error) {
    logger.error({ err: error }, "Legacy organization logo URL cleanup failed");
    process.exitCode = 1;
  }
}
