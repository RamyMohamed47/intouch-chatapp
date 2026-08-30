import { PutBucketCorsCommand, S3Client } from "@aws-sdk/client-s3";
import { pathToFileURL } from "node:url";

import { loadConfig, loadEnvFile } from "../config/env.js";
import { getLogger } from "../config/logger.js";

export const syncStorageCors = async (input: {
  accountId: string;
  accessKeyId: string;
  secretAccessKey: string;
  bucketName: string;
  allowedOrigins: readonly string[];
}) => {
  const client = new S3Client({
    region: "auto",
    endpoint: `https://${input.accountId}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: input.accessKeyId,
      secretAccessKey: input.secretAccessKey,
    },
  });
  await client.send(
    new PutBucketCorsCommand({
      Bucket: input.bucketName,
      CORSConfiguration: {
        CORSRules: [
          {
            AllowedOrigins: [...input.allowedOrigins],
            AllowedMethods: ["PUT", "GET", "HEAD"],
            AllowedHeaders: ["Content-Type"],
            ExposeHeaders: ["ETag"],
            MaxAgeSeconds: 3600,
          },
        ],
      },
    }),
  );
};

const isDirectExecution =
  process.argv[1] !== undefined &&
  import.meta.url === pathToFileURL(process.argv[1]).href;

if (isDirectExecution) {
  loadEnvFile();
  const logger = getLogger();
  try {
    const config = loadConfig();
    if (config.storage.provider !== "r2") {
      throw new Error("STORAGE_PROVIDER must be r2 before synchronizing CORS");
    }
    await syncStorageCors({
      ...config.storage,
      allowedOrigins: config.clientOrigins,
    });
    logger.info(
      { originCount: config.clientOrigins.length },
      "R2 bucket CORS is synchronized",
    );
  } catch (error) {
    logger.error({ err: error }, "R2 bucket CORS synchronization failed");
    process.exitCode = 1;
  }
}
