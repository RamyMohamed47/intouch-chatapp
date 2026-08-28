import assert from "node:assert/strict";
import { describe, test } from "node:test";

import type { PipelineStage } from "mongoose";

import MessageModel from "../src/modules/message/message.model.js";
import createSearchRepository from "../src/modules/search/search.repository.js";

const conversationId = "507f1f77bcf86cd799439001";

describe("search repository", () => {
  test("filters nullable message deletion state after Atlas Search", async () => {
    const originalAggregate = MessageModel.aggregate.bind(MessageModel);
    let capturedPipeline: PipelineStage[] = [];

    Object.defineProperty(MessageModel, "aggregate", {
      configurable: true,
      value: (pipeline: PipelineStage[]) => {
        capturedPipeline = pipeline;
        return { exec: async () => [] };
      },
    });

    try {
      const repository = createSearchRepository("atlas");
      await repository.searchMessages({
        query: "roadmap",
        allowedIds: [conversationId],
        limit: 20,
      });
    } finally {
      Object.defineProperty(MessageModel, "aggregate", {
        configurable: true,
        value: originalAggregate,
      });
    }

    const searchStage = capturedPipeline[0] as {
      $search?: { compound?: { mustNot?: unknown } };
    };
    assert.equal(searchStage.$search?.compound?.mustNot, undefined);
    assert.deepEqual(capturedPipeline[1], {
      $match: { deletedAt: null, content: { $type: "string" } },
    });
  });
});
