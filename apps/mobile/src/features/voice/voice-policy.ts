export const shouldStopCameraForAppState = (
  appState: string,
  cameraEnabled: boolean,
) => cameraEnabled && appState !== "active";

export const canPublishScreenShare = (platform: string) =>
  platform === "android";

export const audioOutputLabel = (output: string) =>
  ({
    bluetooth: "Bluetooth",
    default: "System default",
    earpiece: "Phone earpiece",
    force_speaker: "Speaker",
    headset: "Wired headset",
    speaker: "Speaker",
  })[output] ?? output.replaceAll("_", " ");
