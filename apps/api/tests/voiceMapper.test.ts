import assert from "node:assert/strict";
import { describe, test } from "node:test";

import { messageEventSchema } from "@intouch/shared/realtime";

import {
  toCallDto,
  toCallSummaryDto,
} from "../src/modules/voice/voice.mapper.js";
import type { CallSessionRecord } from "../src/modules/voice/voice.types.js";

const startedAt = new Date("2026-09-02T00:00:00.000Z");
const answeredAt = new Date("2026-09-02T00:00:05.000Z");
const endedAt = new Date("2026-09-02T00:01:10.000Z");

const call: CallSessionRecord = {
  id: "507f1f77bcf86cd799439011",
  organizationId: "507f1f77bcf86cd799439012",
  conversationId: "507f1f77bcf86cd799439013",
  callerUserId: "507f1f77bcf86cd799439014",
  recipientUserId: "507f1f77bcf86cd799439015",
  mediaMode: "VIDEO",
  providerRoomId: "00000000-0000-4000-8000-000000000001",
  timelineMessageId: "507f1f77bcf86cd799439016",
  status: "ENDED",
  endReason: "COMPLETED",
  startedAt,
  acceptedAt: answeredAt,
  answeredAt,
  endedAt,
  createdAt: startedAt,
  updatedAt: endedAt,
};

describe("voice DTO mappers", () => {
  test("keeps conversation metadata out of timeline call summaries", () => {
    const summary = toCallSummaryDto(call);

    assert.equal("organizationId" in summary, false);
    assert.equal("conversationId" in summary, false);
    assert.equal(summary.durationSeconds, 65);
    assert.equal(summary.mediaMode, "VIDEO");
    assert.doesNotThrow(() =>
      messageEventSchema.parse({
        id: call.timelineMessageId,
        conversationId: call.conversationId,
        senderId: call.callerUserId,
        content: null,
        messageType: "CALL",
        editedAt: null,
        deletedAt: null,
        createdAt: startedAt,
        updatedAt: startedAt,
        attachments: [],
        call: summary,
      }),
    );
  });

  test("retains conversation metadata in full call DTOs", () => {
    const dto = toCallDto(call);

    assert.equal(dto.organizationId, call.organizationId);
    assert.equal(dto.conversationId, call.conversationId);
  });
});
