import type { CallSessionRecord } from "../voice/voice.types.js";
import { CallAlertKind } from "./call-alert.model.js";
import type { CallAlertOutboxRepository } from "./call-alert.repository.js";

const RING_TIMEOUT_MS = 30_000;
const STATE_UPDATE_TTL_MS = 5 * 60_000;

export interface CallAlertPublisher {
  incoming(call: CallSessionRecord): Promise<void>;
  stateChanged(call: CallSessionRecord): Promise<void>;
}

export const createCallAlertPublisher = (
  outbox: CallAlertOutboxRepository,
  now: () => Date = () => new Date(),
): CallAlertPublisher => ({
  async incoming(call) {
    const current = now();
    await outbox.enqueue({
      callId: call.id,
      recipientUserId: call.recipientUserId,
      kind: CallAlertKind.INCOMING,
      now: current,
      expiresAt: new Date(call.startedAt.getTime() + RING_TIMEOUT_MS),
    });
  },
  async stateChanged(call) {
    const current = now();
    await outbox.enqueue({
      callId: call.id,
      recipientUserId: call.recipientUserId,
      kind: CallAlertKind.STATE_CHANGED,
      now: current,
      expiresAt: new Date(current.getTime() + STATE_UPDATE_TTL_MS),
    });
  },
});
