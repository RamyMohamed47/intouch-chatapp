import { voiceForegroundNotification } from "./voice-foreground-service-config";

describe("Android voice foreground service", () => {
  test("uses the required microphone service type", () => {
    expect(voiceForegroundNotification.ServiceType).toBe("microphone");
  });
});
