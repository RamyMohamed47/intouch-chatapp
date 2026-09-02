import type {
  CallIncomingEvent,
  CallUpdatedEvent,
  VoiceOccupancyUpdatedEvent,
} from "@intouch/shared/realtime";

export interface VoiceRealtime {
  callIncoming(recipientUserId: string, event: CallIncomingEvent): void;
  callUpdated(userIds: readonly string[], event: CallUpdatedEvent): void;
  voiceOccupancyUpdated(
    userIds: readonly string[],
    event: VoiceOccupancyUpdatedEvent,
  ): void;
}

export const createNoopVoiceRealtime = (): VoiceRealtime => ({
  callIncoming() {},
  callUpdated() {},
  voiceOccupancyUpdated() {},
});
