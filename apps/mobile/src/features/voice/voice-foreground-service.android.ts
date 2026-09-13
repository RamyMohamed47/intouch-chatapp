import ForegroundService from "@supersami/rn-foreground-service";

let registered = false;

const register = () => {
  if (registered) return;
  ForegroundService.register({
    config: {
      alert: false,
      onServiceErrorCallBack: () => undefined,
    },
  });
  registered = true;
};

export const voiceForegroundService = {
  start: async () => {
    register();
    if (ForegroundService.is_running()) return;
    await ForegroundService.start({
      id: 7812,
      title: "InTouch call in progress",
      message: "Tap to return to your voice session",
      icon: "ic_launcher",
      importance: "low",
      visibility: "public",
      vibration: false,
      setOnlyAlertOnce: "true",
    });
  },
  stop: async () => {
    if (registered && ForegroundService.is_running()) {
      await ForegroundService.stop();
    }
  },
};
