import mongoose from "mongoose";

import { getLogger } from "./logger.js";

import type { Logger } from "pino";

const connectDatabase = async (
  databaseUri: string,
  logger: Logger = getLogger(),
) => {
  await mongoose.connect(databaseUri);
  logger.info("DB connection successful");
};

export default connectDatabase;
