import { callDtoSchema, callSummaryDtoSchema } from "@intouch/shared/voice";

import type { CallSessionRecord } from "./voice.types.js";

const callSummaryPayload = (call: CallSessionRecord) => ({
  id: call.id,
  callerUserId: call.callerUserId,
  recipientUserId: call.recipientUserId,
  status: call.status,
  endReason: call.endReason,
  startedAt: call.startedAt,
  answeredAt: call.answeredAt,
  endedAt: call.endedAt,
  durationSeconds:
    call.answeredAt && call.endedAt
      ? Math.max(
          0,
          Math.floor(
            (call.endedAt.getTime() - call.answeredAt.getTime()) / 1_000,
          ),
        )
      : null,
});

export const toCallSummaryDto = (call: CallSessionRecord) =>
  callSummaryDtoSchema.parse(callSummaryPayload(call));

export const toCallDto = (call: CallSessionRecord) =>
  callDtoSchema.parse({
    ...callSummaryPayload(call),
    organizationId: call.organizationId,
    conversationId: call.conversationId,
  });
