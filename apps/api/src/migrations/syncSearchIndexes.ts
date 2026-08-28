import { pathToFileURL } from "node:url";

import connectDatabase, { disconnectDatabase } from "../config/database.js";
import { loadConfig, loadEnvFile } from "../config/env.js";
import { getLogger } from "../config/logger.js";
import ConversationModel from "../modules/conversations/conversation.model.js";
import MessageModel from "../modules/message/message.model.js";
import { SEARCH_INDEX_DEFINITIONS } from "../modules/search/search.indexes.js";
import { UserModel } from "../modules/user/user.model.js";

interface SearchIndexStatus {
  name: string;
  status?: string;
  queryable?: boolean;
}

interface SearchIndexTarget {
  model: {
    listSearchIndexes(): Promise<Array<{ name: string }>>;
    createSearchIndex(input: {
      name: string;
      definition: Record<string, unknown>;
    }): Promise<string>;
    updateSearchIndex(
      name: string,
      definition: Record<string, unknown>,
    ): Promise<void>;
  };
  name: string;
  definition: Record<string, unknown>;
}

const targets: SearchIndexTarget[] = [
  {
    model: MessageModel,
    ...SEARCH_INDEX_DEFINITIONS.messages,
  },
  {
    model: ConversationModel,
    ...SEARCH_INDEX_DEFINITIONS.conversations,
  },
  {
    model: UserModel,
    ...SEARCH_INDEX_DEFINITIONS.users,
  },
];

const waitForReady = async (
  target: SearchIndexTarget,
  timeoutMs = 10 * 60 * 1000,
) => {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const indexes =
      (await target.model.listSearchIndexes()) as SearchIndexStatus[];
    const index = indexes.find(({ name }) => name === target.name);
    if (index?.queryable === true || index?.status === "READY") return;
    await new Promise((resolve) => setTimeout(resolve, 2_000));
  }
  throw new Error(`Search index ${target.name} did not become ready in time`);
};

export const syncSearchIndexes = async () => {
  for (const target of targets) {
    const indexes =
      (await target.model.listSearchIndexes()) as SearchIndexStatus[];
    if (indexes.some(({ name }) => name === target.name)) {
      await target.model.updateSearchIndex(target.name, target.definition);
    } else {
      await target.model.createSearchIndex({
        name: target.name,
        definition: target.definition,
      });
    }
  }
  await Promise.all(targets.map((target) => waitForReady(target)));
};

const isDirectExecution =
  process.argv[1] !== undefined &&
  import.meta.url === pathToFileURL(process.argv[1]).href;

if (isDirectExecution) {
  loadEnvFile();
  const logger = getLogger();
  try {
    const config = loadConfig();
    if (config.searchProvider !== "atlas") {
      throw new Error(
        "SEARCH_PROVIDER must be atlas before synchronizing Atlas Search indexes",
      );
    }
    await connectDatabase(config.databaseUri, logger);
    await syncSearchIndexes();
    logger.info(
      { indexes: targets.map(({ name }) => name) },
      "Atlas search indexes are ready",
    );
  } catch (error) {
    logger.error({ err: error }, "Atlas search index synchronization failed");
    process.exitCode = 1;
  } finally {
    await disconnectDatabase(logger);
  }
}
