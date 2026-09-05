import assert from "node:assert/strict";
import { describe, test } from "node:test";

import {
  callDtoSchema,
  joinVoiceSessionSchema,
  startCallSchema,
  voiceHeartbeatSchema,
  voiceOccupancyDtoSchema,
} from "../voice/index.js";

const objectId = "507f1f77bcf86cd799439011";

describe("voice contracts", () => {
  test("defaults replacement to false and rejects extra input", () => {
    assert.deepEqual(joinVoiceSessionSchema.parse({}), {
      replaceActiveSession: false,
    });
    assert.throws(() =>
      joinVoiceSessionSchema.parse({
        replaceActiveSession: false,
        token: "no",
      }),
    );
    assert.throws(() => voiceHeartbeatSchema.parse({ sessionId: objectId }));
    assert.deepEqual(startCallSchema.parse({}), {
      replaceActiveSession: false,
      mediaMode: "AUDIO",
    });
    assert.equal(
      startCallSchema.parse({ mediaMode: "VIDEO" }).mediaMode,
      "VIDEO",
    );
    assert.throws(() => startCallSchema.parse({ mediaMode: "SCREEN" }));
  });

  test("requires strict authorized occupancy mappings", () => {
    const occupancy = voiceOccupancyDtoSchema.parse({
      conversationId: objectId,
      capacity: 10,
      participantUserIds: [objectId],
      participants: [
        {
          userId: objectId,
          participantIdentity: "00000000-0000-4000-8000-000000000001",
        },
      ],
    });
    assert.equal(occupancy.participants[0]?.userId, objectId);
    assert.throws(() =>
      voiceOccupancyDtoSchema.parse({
        ...occupancy,
        participants: [{ userId: objectId, participantIdentity: objectId }],
      }),
    );
  });

  test("validates durable call lifecycle DTOs", () => {
    const call = callDtoSchema.parse({
      id: objectId,
      organizationId: objectId,
      conversationId: objectId,
      callerUserId: objectId,
      recipientUserId: objectId,
      mediaMode: "VIDEO",
      status: "ENDED",
      endReason: "COMPLETED",
      startedAt: "2026-09-01T00:00:00.000Z",
      answeredAt: "2026-09-01T00:00:02.000Z",
      endedAt: "2026-09-01T00:00:12.000Z",
      durationSeconds: 10,
    });
    assert.equal(call.durationSeconds, 10);
    assert.throws(() => callDtoSchema.parse({ ...call, roomName: "private" }));
  });
});
