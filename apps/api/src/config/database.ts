import mongoose from "mongoose";

import { getLogger } from "./logger.js";

import type { Logger } from "pino";

interface MongoHelloResponse {
  msg?: unknown;
  setName?: unknown;
}

export const assertTransactionSupport = (hello: MongoHelloResponse) => {
  const isReplicaSet =
    typeof hello.setName === "string" && hello.setName.length > 0;
  const isShardedCluster = hello.msg === "isdbgrid";

  if (!isReplicaSet && !isShardedCluster) {
    throw new Error(
      "MongoDB transactions require a replica set or sharded cluster. Configure a single-node replica set for local development.",
    );
  }
};

const connectDatabase = async (
  databaseUri: string,
  logger: Logger = getLogger(),
) => {
  await mongoose.connect(databaseUri);
  const database = mongoose.connection.db;

  if (!database) {
    throw new Error("MongoDB connection did not expose a database handle");
  }

  const hello = (await database
    .admin()
    .command({ hello: 1 })) as MongoHelloResponse;
  assertTransactionSupport(hello);
  logger.info("DB connection successful");
};

export const disconnectDatabase = async (logger: Logger = getLogger()) => {
  await mongoose.disconnect();
  logger.info("DB connection closed");
};

export default connectDatabase;
