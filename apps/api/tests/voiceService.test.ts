import assert from "node:assert/strict";
import { describe, test } from "node:test";

import { CallEndReason, CallStatus } from "@intouch/shared/voice";

import { VoiceCallJobKind } from "../src/modules/voice/voice-call.jobs.js";
import createVoiceService, {
  type VoiceServiceDependencies,
} from "../src/modules/voice/voice.service.js";
import type { CallSessionRecord } from "../src/modules/voice/voice.types.js";

const startedAt = new Date("2026-09-02T00:00:00.000Z");
const call: CallSessionRecord = {
  id: "507f1f77bcf86cd799439011",
  organizationId: "507f1f77bcf86cd799439012",
  conversationId: "507f1f77bcf86cd799439013",
  callerUserId: "507f1f77bcf86cd799439014",
  recipientUserId: "507f1f77bcf86cd799439015",
  mediaMode: "AUDIO",
  providerRoomId: "00000000-0000-4000-8000-000000000001",
  timelineMessageId: "507f1f77bcf86cd799439016",
  status: CallStatus.RINGING,
  endReason: null,
  startedAt,
  acceptedAt: null,
  answeredAt: null,
  endedAt: null,
  createdAt: startedAt,
  updatedAt: startedAt,
};

describe("voice service reconciliation", () => {
  test("ends ringing calls whose delayed timeout job was missed", async () => {
    let transitionInput:
      | {
          callId: string;
          endReason: string | undefined;
          from: readonly string[];
          status: string;
        }
      | undefined;
    let closedRoomId: string | undefined;
    let publishedStatus: string | undefined;
    const endedCall: CallSessionRecord = {
      ...call,
      status: CallStatus.ENDED,
      endReason: CallEndReason.MISSED,
      endedAt: new Date("2026-09-02T00:01:00.000Z"),
    };
    const dependencies = {
      calls: {
        findTimedOutPending: async () => [call],
        transition: async (
          callId: string,
          from: readonly string[],
          input: { status: string; endReason?: string },
        ) => {
          transitionInput = {
            callId,
            from,
            status: input.status,
            endReason: input.endReason,
          };
          return endedCall;
        },
      },
      jobs: { setHandler() {} },
      logger: { error() {}, warn() {} },
      media: {
        closeRoom: async (providerRoomId: string) => {
          closedRoomId = providerRoomId;
        },
      },
      realtime: {
        callUpdated: (
          _userIds: readonly string[],
          event: { call: { status: string } },
        ) => {
          publishedStatus = event.call.status;
        },
      },
      sessions: {
        getByUser: async () => null,
        listReserved: async () => [],
        releaseSessions: async () => undefined,
      },
    } as unknown as VoiceServiceDependencies;
    const service = createVoiceService(dependencies);

    await service.handleJob({ kind: VoiceCallJobKind.RECONCILE });

    assert.deepEqual(transitionInput, {
      callId: call.id,
      from: [CallStatus.RINGING],
      status: CallStatus.ENDED,
      endReason: CallEndReason.MISSED,
    });
    assert.equal(closedRoomId, call.providerRoomId);
    assert.equal(publishedStatus, CallStatus.ENDED);
  });
});
