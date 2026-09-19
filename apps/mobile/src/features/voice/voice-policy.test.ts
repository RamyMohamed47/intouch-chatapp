import {
  CallEndReason,
  CallMediaMode,
  CallStatus,
  type CallDto,
} from "@intouch/shared/voice";

import {
  audioOutputLabel,
  canPublishScreenShare,
  mergeVoiceParticipantIdentities,
  mobileVoiceRoomOptions,
  shouldStopCameraForAppState,
  voiceHeartbeatDelayMs,
  voiceSessionRestoreAction,
} from "@/features/voice/voice-policy";

const call = (overrides: Partial<CallDto> = {}): CallDto => ({
  id: "call-1",
  organizationId: "organization-1",
  conversationId: "conversation-1",
  callerUserId: "caller-1",
  recipientUserId: "recipient-1",
  mediaMode: CallMediaMode.AUDIO,
  status: CallStatus.RINGING,
  endReason: null,
  startedAt: "2026-09-14T12:00:00.000Z",
  answeredAt: null,
  endedAt: null,
  durationSeconds: null,
  ...overrides,
});

describe("mobile voice policy", () => {
  test("stops an enabled camera when the application leaves foreground", () => {
    expect(shouldStopCameraForAppState("background", true)).toBe(true);
    expect(shouldStopCameraForAppState("inactive", true)).toBe(true);
    expect(shouldStopCameraForAppState("active", true)).toBe(false);
    expect(shouldStopCameraForAppState("background", false)).toBe(false);
  });

  test("publishes screen shares only from Android in this release", () => {
    expect(canPublishScreenShare("android")).toBe(true);
    expect(canPublishScreenShare("ios")).toBe(false);
  });

  test("uses the reliable native subscriber transport configuration", () => {
    expect(mobileVoiceRoomOptions).toMatchObject({
      adaptiveStream: { pixelDensity: "screen" },
      dynacast: true,
      singlePeerConnection: false,
    });
  });

  test("probes quickly after joining before settling into keep-alive", () => {
    expect(voiceHeartbeatDelayMs(0)).toBe(3_000);
    expect(voiceHeartbeatDelayMs(3)).toBe(3_000);
    expect(voiceHeartbeatDelayMs(4)).toBe(30_000);
  });

  test("merges provider and authorized occupancy identities without duplicates", () => {
    expect(
      mergeVoiceParticipantIdentities(
        ["local", "provider-remote"],
        ["local", "authorized-remote", ""],
      ),
    ).toEqual(["local", "provider-remote", "authorized-remote"]);
  });

  test("formats native audio output identifiers for the route picker", () => {
    expect(audioOutputLabel("bluetooth")).toBe("Bluetooth");
    expect(audioOutputLabel("force_speaker")).toBe("Speaker");
    expect(audioOutputLabel("usb_headset")).toBe("usb headset");
  });

  test("does not resume a ringing recipient reservation", () => {
    expect(voiceSessionRestoreAction(call(), "recipient-1")).toBe("incoming");
    expect(voiceSessionRestoreAction(call(), "caller-1")).toBe("resume");
  });

  test("releases terminal call reservations", () => {
    expect(
      voiceSessionRestoreAction(
        call({
          status: CallStatus.ENDED,
          endReason: CallEndReason.CANCELLED,
          endedAt: "2026-09-14T12:00:30.000Z",
        }),
        "recipient-1",
      ),
    ).toBe("release");
  });
});
