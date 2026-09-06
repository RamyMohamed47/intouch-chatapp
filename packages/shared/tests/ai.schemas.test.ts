import assert from "node:assert/strict";
import { describe, test } from "node:test";

import {
  AiComposeAction,
  AiTask,
  aiOrganizationSettingsUpdateSchema,
  aiResponseRequestSchema,
  aiSseEventSchema,
} from "../ai/index.js";

describe("AI contracts", () => {
  test("accepts strict ask, summary, and composer requests", () => {
    assert.equal(
      aiResponseRequestSchema.parse({
        task: AiTask.ASK,
        prompt: "What did we decide?",
        scope: { kind: "ORGANIZATION" },
      }).task,
      AiTask.ASK,
    );
    assert.equal(
      aiResponseRequestSchema.parse({
        task: AiTask.SUMMARIZE,
        conversationId: "507f1f77bcf86cd799439011",
        mode: "ACTION_ITEMS",
      }).task,
      AiTask.SUMMARIZE,
    );
    assert.equal(
      aiResponseRequestSchema.parse({
        task: AiTask.COMPOSE,
        action: AiComposeAction.TRANSLATE,
        text: "Hello",
        targetLanguage: "Arabic",
      }).task,
      AiTask.COMPOSE,
    );
  });

  test("rejects excessive history, unknown fields, and invalid translation input", () => {
    assert.equal(
      aiResponseRequestSchema.safeParse({
        task: AiTask.ASK,
        prompt: "Question",
        scope: { kind: "ORGANIZATION" },
        history: [{ role: "user", content: "x".repeat(2_000) }],
        unexpected: true,
      }).success,
      false,
    );
    assert.equal(
      aiResponseRequestSchema.safeParse({
        task: AiTask.COMPOSE,
        action: AiComposeAction.TRANSLATE,
        text: "Hello",
      }).success,
      false,
    );
  });

  test("requires provider acknowledgement when enabling AI", () => {
    assert.equal(
      aiOrganizationSettingsUpdateSchema.safeParse({
        enabled: true,
        disclosureVersion: "ai-data-use-v1",
      }).success,
      false,
    );
    assert.equal(
      aiOrganizationSettingsUpdateSchema.safeParse({
        enabled: true,
        disclosureVersion: "ai-data-use-v1",
        acceptsProviderDataUse: true,
      }).success,
      true,
    );
  });

  test("validates typed stream events", () => {
    assert.equal(
      aiSseEventSchema.safeParse({ type: "delta", text: "Hello" }).success,
      true,
    );
    assert.equal(
      aiSseEventSchema.safeParse({
        type: "delta",
        text: "Hello",
        userId: "secret",
      }).success,
      false,
    );
  });
});
