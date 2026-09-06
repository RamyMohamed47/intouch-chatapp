import type {
  CallIncomingEvent,
  CallUpdatedEvent,
  ScreenShareStopRequestedEvent,
  VoiceOccupancyUpdatedEvent,
} from "@intouch/shared/realtime";

export interface VoiceRealtime {
  callIncoming(recipientUserId: string, event: CallIncomingEvent): void;
  callUpdated(userIds: readonly string[], event: CallUpdatedEvent): void;
  screenShareStopRequested(
    recipientUserId: string,
    event: ScreenShareStopRequestedEvent,
  ): void;
  voiceOccupancyUpdated(
    userIds: readonly string[],
    event: VoiceOccupancyUpdatedEvent,
  ): void;
}

export const createNoopVoiceRealtime = (): VoiceRealtime => ({
  callIncoming() {},
  callUpdated() {},
  screenShareStopRequested() {},
  voiceOccupancyUpdated() {},
});
