import { CallStatus, type CallDto } from "@intouch/shared/voice";

export const mobileVoiceRoomOptions = {
  adaptiveStream: { pixelDensity: "screen" as const },
  dynacast: true,
  // React Native's separate subscriber transport is more reliable than the
  // browser-oriented single peer connection path for receiving remote media.
  singlePeerConnection: false,
};

export type VoiceSessionRestoreAction = "incoming" | "release" | "resume";

export const voiceSessionRestoreAction = (
  call: CallDto,
  currentUserId: string,
): VoiceSessionRestoreAction => {
  if (call.status === CallStatus.ENDED) return "release";
  if (
    call.status === CallStatus.RINGING &&
    call.recipientUserId === currentUserId
  ) {
    return "incoming";
  }
  return "resume";
};

export const shouldStopCameraForAppState = (
  appState: string,
  cameraEnabled: boolean,
) => cameraEnabled && appState !== "active";

export const canPublishScreenShare = (platform: string) =>
  platform === "android";

export const mergeVoiceParticipantIdentities = (
  providerIdentities: readonly string[],
  authorizedIdentities: readonly string[],
) => {
  const identities = new Set<string>();
  for (const identity of [...providerIdentities, ...authorizedIdentities]) {
    if (identity) identities.add(identity);
  }
  return [...identities];
};

export const audioOutputLabel = (output: string) =>
  ({
    bluetooth: "Bluetooth",
    default: "System default",
    earpiece: "Phone earpiece",
    force_speaker: "Speaker",
    headset: "Wired headset",
    speaker: "Speaker",
  })[output] ?? output.replaceAll("_", " ");
