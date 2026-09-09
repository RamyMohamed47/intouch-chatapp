import type {
  PushDeviceDto,
  RegisterPushDeviceInput,
} from "@intouch/shared/push";

import type { PushTokenCipher } from "./push.crypto.js";
import type { PushDeviceRepository } from "./push-device.repository.js";

export const createPushDeviceService = (dependencies: {
  cipher: PushTokenCipher;
  devices: PushDeviceRepository;
  now?: () => Date;
}) => ({
  async register(
    userId: string,
    installationId: string,
    input: RegisterPushDeviceInput,
  ): Promise<PushDeviceDto> {
    const encrypted = dependencies.cipher.encrypt(input.expoPushToken);
    const device = await dependencies.devices.register({
      userId,
      installationId,
      platform: input.platform,
      tokenHash: dependencies.cipher.hash(input.expoPushToken),
      ...encrypted,
      registeredAt: dependencies.now?.() ?? new Date(),
    });
    return {
      installationId: device.installationId,
      platform: device.platform,
      enabled: device.enabled,
      updatedAt: device.updatedAt,
    };
  },
  remove(userId: string, installationId: string) {
    return dependencies.devices.disableInstallation(userId, installationId);
  },
});

export type PushDeviceService = ReturnType<typeof createPushDeviceService>;
