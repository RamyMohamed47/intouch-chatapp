import * as Crypto from "expo-crypto";
import * as SecureStore from "expo-secure-store";

const INSTALLATION_ID_KEY = "intouch.push-installation.v1";

export const pushDeviceStore = {
  async getInstallationId() {
    const existing = await SecureStore.getItemAsync(INSTALLATION_ID_KEY);
    if (existing) return existing;
    const installationId = Crypto.randomUUID();
    await SecureStore.setItemAsync(INSTALLATION_ID_KEY, installationId);
    return installationId;
  },
};
