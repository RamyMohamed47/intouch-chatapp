import ForegroundService from "@supersami/rn-foreground-service";

import { voiceForegroundNotification } from "./voice-foreground-service-config";

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
    await ForegroundService.start(voiceForegroundNotification);
  },
  stop: async () => {
    if (registered && ForegroundService.is_running()) {
      await ForegroundService.stop();
    }
  },
};
