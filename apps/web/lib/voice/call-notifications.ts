import type { CallDto } from "@intouch/shared/voice";

export const CALL_NOTIFICATION_PREFERENCE = "intouch:call-notifications";

const SERVICE_WORKER_PATH = "/call-notifications-sw.js";
const SERVICE_WORKER_SCOPE = "/";

const assertNotificationSupport = () => {
  if (!window.isSecureContext) {
    throw new Error(
      "Browser notifications require HTTPS or localhost. They are unavailable on an insecure network address.",
    );
  }
  if (!("Notification" in window)) {
    throw new Error("This browser does not support notifications.");
  }
  if (!("serviceWorker" in navigator)) {
    throw new Error(
      "This browser does not support background call notifications.",
    );
  }
};

const readyRegistration = async () => {
  const existing =
    await navigator.serviceWorker.getRegistration(SERVICE_WORKER_SCOPE);
  if (!existing?.active) {
    await navigator.serviceWorker.register(SERVICE_WORKER_PATH, {
      scope: SERVICE_WORKER_SCOPE,
    });
  }
  return navigator.serviceWorker.ready;
};

export const callNotificationsEnabled = () =>
  localStorage.getItem(CALL_NOTIFICATION_PREFERENCE) === "enabled";

export const enableCallNotifications = async () => {
  assertNotificationSupport();
  const permission =
    Notification.permission === "default"
      ? await Notification.requestPermission()
      : Notification.permission;
  if (permission !== "granted") {
    throw new Error(
      permission === "denied"
        ? "Notification permission is blocked. Enable it in your browser settings and try again."
        : "Notification permission was not granted.",
    );
  }

  await readyRegistration();
  localStorage.setItem(CALL_NOTIFICATION_PREFERENCE, "enabled");
};

export const disableCallNotifications = () => {
  localStorage.removeItem(CALL_NOTIFICATION_PREFERENCE);
};

export const showIncomingCallNotification = async (
  call: CallDto,
  callerDisplayName: string,
) => {
  if (!callNotificationsEnabled()) return;
  assertNotificationSupport();
  if (Notification.permission !== "granted") {
    throw new Error("Browser notification permission is no longer granted.");
  }

  const registration = await readyRegistration();
  await registration.showNotification(
    `Incoming InTouch ${call.mediaMode === "VIDEO" ? "video" : "voice"} call`,
    {
      body: `${callerDisplayName} is calling`,
      data: {
        href: `/app/${call.organizationId}/direct-messages/${call.conversationId}`,
      },
      icon: "/brand/intouch-icon-192.png",
      badge: "/brand/intouch-icon-192.png",
      requireInteraction: true,
      tag: `intouch-call-${call.id}`,
    },
  );
};

export const dismissIncomingCallNotification = async (callId: string) => {
  if (!("serviceWorker" in navigator)) return;
  const registration =
    await navigator.serviceWorker.getRegistration(SERVICE_WORKER_SCOPE);
  if (!registration) return;
  const notifications = await registration.getNotifications({
    tag: `intouch-call-${callId}`,
  });
  notifications.forEach((notification) => notification.close());
};
