import {
  audioOutputLabel,
  canPublishScreenShare,
  shouldStopCameraForAppState,
} from "@/features/voice/voice-policy";

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

  test("formats native audio output identifiers for the route picker", () => {
    expect(audioOutputLabel("bluetooth")).toBe("Bluetooth");
    expect(audioOutputLabel("force_speaker")).toBe("Speaker");
    expect(audioOutputLabel("usb_headset")).toBe("usb headset");
  });
});
