import type { CallDto } from "@intouch/shared/voice";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  CALL_NOTIFICATION_PREFERENCE,
  enableCallNotifications,
  showIncomingCallNotification,
} from "@/lib/voice/call-notifications";

const call: CallDto = {
  id: "507f1f77bcf86cd799439015",
  organizationId: "507f1f77bcf86cd799439013",
  conversationId: "507f1f77bcf86cd799439012",
  callerUserId: "507f1f77bcf86cd799439011",
  recipientUserId: "507f1f77bcf86cd799439014",
  mediaMode: "VIDEO",
  status: "RINGING",
  endReason: null,
  startedAt: "2026-09-01T00:00:00.000Z",
  answeredAt: null,
  endedAt: null,
  durationSeconds: null,
};

describe("call notifications", () => {
  const showNotification = vi.fn();
  const register = vi.fn();
  const registration = {
    active: {},
    getNotifications: vi.fn(),
    showNotification,
  } as unknown as ServiceWorkerRegistration;

  beforeEach(() => {
    localStorage.clear();
    showNotification.mockReset();
    showNotification.mockResolvedValue(undefined);
    register.mockReset();
    register.mockResolvedValue(registration);
    vi.stubGlobal("Notification", {
      permission: "granted",
      requestPermission: vi.fn().mockResolvedValue("granted"),
    });
    Object.defineProperty(window, "isSecureContext", {
      configurable: true,
      value: true,
    });
    Object.defineProperty(navigator, "serviceWorker", {
      configurable: true,
      value: {
        getRegistration: vi.fn().mockResolvedValue(null),
        ready: Promise.resolve(registration),
        register,
      },
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("registers the worker before persisting the preference", async () => {
    await enableCallNotifications();

    expect(register).toHaveBeenCalledWith("/call-notifications-sw.js", {
      scope: "/",
    });
    expect(localStorage.getItem(CALL_NOTIFICATION_PREFERENCE)).toBe("enabled");
  });

  it("shows a tagged notification that opens the direct conversation", async () => {
    localStorage.setItem(CALL_NOTIFICATION_PREFERENCE, "enabled");

    await showIncomingCallNotification(call, "Lina Hassan");

    expect(showNotification).toHaveBeenCalledWith(
      "Incoming InTouch video call",
      expect.objectContaining({
        body: "Lina Hassan is calling",
        data: {
          href: `/app/${call.organizationId}/direct-messages/${call.conversationId}`,
        },
        tag: `intouch-call-${call.id}`,
      }),
    );
  });
});
