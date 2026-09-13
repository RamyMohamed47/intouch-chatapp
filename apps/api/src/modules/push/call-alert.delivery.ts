import { CallMediaMode, CallStatus, type CallDto } from "@intouch/shared/voice";
import { CallPushEventType } from "@intouch/shared/push";
import type { Logger } from "pino";

import { getObservabilityMetrics } from "../../infrastructure/observability/index.js";
import type { NotificationPreferenceRepository } from "../notifications/notification-preference.repository.js";
import type { UserRepository } from "../user/user.repository.js";
import type { CallSessionRepository } from "../voice/call.repository.js";
import { toCallDto } from "../voice/voice.mapper.js";
import { CallAlertKind } from "./call-alert.model.js";
import type {
  CallAlertOutboxRecord,
  CallAlertOutboxRepository,
} from "./call-alert.repository.js";
import type { PushTokenCipher } from "./push.crypto.js";
import type { PushDeviceRepository } from "./push-device.repository.js";
import type { PushProvider } from "./push.types.js";

const RETRY_DELAYS_MS = [1_000, 3_000, 7_000] as const;
const MAX_ATTEMPTS = 4;

export interface CallAlertDeliveryDependencies {
  calls: Pick<CallSessionRepository, "findById">;
  cipher: PushTokenCipher;
  devices: PushDeviceRepository;
  logger: Pick<Logger, "warn">;
  outbox: CallAlertOutboxRepository;
  preferences: Pick<NotificationPreferenceRepository, "allowsCallInterruption">;
  provider: PushProvider;
  users: Pick<UserRepository, "findPublicById">;
  now?: () => Date;
}

const errorCode = (error: unknown) =>
  error instanceof Error && error.name ? error.name : "CALL_PUSH_ERROR";

const pushData = (call: CallDto, kind: CallAlertOutboxRecord["kind"]) =>
  kind === CallAlertKind.INCOMING
    ? {
        type: CallPushEventType.INCOMING,
        callId: call.id,
        organizationId: call.organizationId,
        conversationId: call.conversationId,
        mediaMode: call.mediaMode,
        startedAt: call.startedAt,
      }
    : { type: CallPushEventType.STATE_CHANGED, callId: call.id };

export const deliverCallAlert = async (
  dependencies: CallAlertDeliveryDependencies,
  record: CallAlertOutboxRecord,
) => {
  const now = dependencies.now?.() ?? new Date();
  const source = await dependencies.calls.findById(record.callId);
  if (!source) {
    getObservabilityMetrics().recordCallPushOutcome("stale");
    await dependencies.outbox.markComplete(record.id, now);
    return;
  }
  const call = toCallDto(source);
  if (
    record.kind === CallAlertKind.INCOMING &&
    call.status !== CallStatus.RINGING
  ) {
    getObservabilityMetrics().recordCallPushOutcome("stale");
    await dependencies.outbox.markComplete(record.id, now);
    return;
  }
  if (
    record.kind === CallAlertKind.INCOMING &&
    !(await dependencies.preferences.allowsCallInterruption({
      userId: record.recipientUserId,
      organizationId: call.organizationId,
      conversationId: call.conversationId,
      now,
    }))
  ) {
    getObservabilityMetrics().recordCallPushOutcome("suppressed");
    await dependencies.outbox.markComplete(record.id, now);
    return;
  }
  const devices = await dependencies.devices.listEnabledForUser(
    record.recipientUserId,
  );
  if (devices.length === 0) {
    getObservabilityMetrics().recordCallPushOutcome("suppressed");
    await dependencies.outbox.markComplete(record.id, now);
    return;
  }

  const caller =
    record.kind === CallAlertKind.INCOMING
      ? await dependencies.users.findPublicById(call.callerUserId)
      : null;
  const ttlSeconds = Math.max(
    1,
    Math.ceil((record.expiresAt.getTime() - now.getTime()) / 1_000),
  );
  const callKey = `call:${call.id}`;
  const data = pushData(call, record.kind);
  const tickets = await dependencies.provider.send(
    devices.map((device) => ({
      token: dependencies.cipher.decrypt(device),
      data,
      ttlSeconds,
      collapseId: callKey,
      tag: callKey,
      ...(record.kind === CallAlertKind.INCOMING
        ? {
            title: `${caller?.displayName ?? "A teammate"} is calling`,
            body:
              call.mediaMode === CallMediaMode.VIDEO
                ? "Incoming InTouch video call"
                : "Incoming InTouch voice call",
            channelId: "intouch-calls-v1",
            sound: "intouch-call.wav",
            interruptionLevel: "time-sensitive" as const,
          }
        : {
            title: "",
            body: "",
            sound: null,
            contentAvailable: true,
          }),
    })),
  );
  for (let index = 0; index < tickets.length; index += 1) {
    const ticket = tickets[index];
    const device = devices[index];
    if (!ticket || !device) continue;
    if (ticket.status === "OK") {
      getObservabilityMetrics().recordCallPushOutcome("sent");
      continue;
    }
    getObservabilityMetrics().recordCallPushOutcome("rejected");
    if (ticket.errorCode === "DeviceNotRegistered") {
      await dependencies.devices.disableById(device.id, now);
    }
    dependencies.logger.warn(
      { callAlertOutboxId: record.id, errorCode: ticket.errorCode },
      "Call alert push ticket rejected",
    );
  }
  await dependencies.outbox.markComplete(record.id, now);
};

export const handleCallAlertFailure = async (
  dependencies: CallAlertDeliveryDependencies,
  record: CallAlertOutboxRecord,
  error: unknown,
) => {
  const now = dependencies.now?.() ?? new Date();
  const delay = RETRY_DELAYS_MS[record.attempts - 1];
  const canRetry =
    record.attempts < MAX_ATTEMPTS &&
    delay !== undefined &&
    now.getTime() + delay < record.expiresAt.getTime();
  if (canRetry) {
    getObservabilityMetrics().recordCallPushOutcome("retried");
    await dependencies.outbox.scheduleRetry(
      record.id,
      new Date(now.getTime() + delay),
      errorCode(error),
    );
  } else {
    getObservabilityMetrics().recordCallPushOutcome("failed");
    await dependencies.outbox.markFailed(record.id, now, errorCode(error));
  }
  dependencies.logger.warn(
    {
      callAlertOutboxId: record.id,
      retryScheduled: canRetry,
      errorCode: errorCode(error),
    },
    "Call alert push delivery failed",
  );
};
