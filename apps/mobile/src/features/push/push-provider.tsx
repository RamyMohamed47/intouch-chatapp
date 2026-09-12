import AsyncStorage from "@react-native-async-storage/async-storage";
import { useQueryClient } from "@tanstack/react-query";
import Constants from "expo-constants";
import * as Device from "expo-device";
import * as Notifications from "expo-notifications";
import { NotificationStatus } from "@intouch/shared/notifications";
import { router } from "expo-router";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type PropsWithChildren,
} from "react";
import { Alert, AppState, Platform } from "react-native";

import { useAuth } from "@/features/auth/auth-provider";
import {
  foregroundInterruptionDeduper,
  getForegroundNotificationPreferences,
  shouldShowForegroundPush,
} from "@/features/notifications/foreground-notification-policy";
import { notificationsApi } from "@/features/notifications/notifications-api";
import { useWorkspace } from "@/features/organizations/workspace-provider";
import { pushApi } from "@/features/push/push-api";
import { pushDeviceStore } from "@/features/push/push-device-store";

type PushState =
  "checking" | "disabled" | "enabled" | "blocked" | "unavailable";

interface PushContextValue {
  disable: () => Promise<void>;
  enable: () => Promise<void>;
  state: PushState;
}

const PushContext = createContext<PushContextValue | null>(null);
const PROMPT_KEY_PREFIX = "intouch.push-prompt.v1";
const DISABLED_KEY_PREFIX = "intouch.push-disabled.v1";

Notifications.setNotificationHandler({
  handleNotification: (notification) => {
    const foreground = AppState.currentState === "active";
    const data = notification.request.content.data ?? {};
    const organizationId = data.organizationId;
    const conversationId = data.conversationId;
    const interrupt =
      foreground &&
      typeof organizationId === "string" &&
      shouldShowForegroundPush(data, getForegroundNotificationPreferences()) &&
      foregroundInterruptionDeduper.claim(
        {
          organizationId,
          ...(typeof conversationId === "string" ? { conversationId } : {}),
        },
        "EXPO",
      );

    return Promise.resolve({
      shouldPlaySound: !foreground,
      shouldSetBadge: true,
      shouldShowBanner: !foreground || interrupt,
      shouldShowList: true,
    });
  },
});

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

const projectId = () => {
  const extra: unknown = Constants.expoConfig?.extra;
  if (!isRecord(extra) || !isRecord(extra.eas)) return null;
  const value = extra.eas.projectId;
  return typeof value === "string" ? value : null;
};

const openPushData = async (
  data: Record<string, unknown>,
  setActiveOrganizationId: (organizationId: string | null) => void,
) => {
  const notificationId = data.notificationId;
  if (typeof notificationId === "string") {
    await notificationsApi.markRead(notificationId).catch(() => undefined);
  }
  const conversationId = data.conversationId;
  const messageId = data.messageId;
  const organizationId = data.organizationId;
  if (typeof organizationId === "string") {
    setActiveOrganizationId(organizationId);
  }
  if (typeof conversationId === "string") {
    router.push({
      pathname: "/conversation/[conversationId]",
      params: {
        conversationId,
        ...(typeof messageId === "string" ? { messageId } : {}),
      },
    });
    return;
  }
  if (data.type === "ORGANIZATION_INVITATION_RECEIVED") {
    router.push("/workspaces");
  } else if (typeof organizationId === "string") {
    router.push({
      pathname: "/workspace/[organizationId]",
      params: { organizationId },
    });
  }
};

export const PushProvider = ({ children }: PropsWithChildren) => {
  const { status, user } = useAuth();
  const { setActiveOrganizationId } = useWorkspace();
  const queryClient = useQueryClient();
  const [state, setState] = useState<PushState>("checking");
  const registrationPromiseRef = useRef<Promise<void> | null>(null);

  const reconcileBadge = useCallback(async () => {
    if (status !== "authenticated") {
      await Notifications.setBadgeCountAsync(0).catch(() => false);
      return;
    }
    const page = await notificationsApi.list(NotificationStatus.UNREAD);
    await Notifications.setBadgeCountAsync(page.unreadCount).catch(() => false);
  }, [status]);

  const register = useCallback(
    (devicePushToken?: Notifications.DevicePushToken) => {
      if (registrationPromiseRef.current) {
        return registrationPromiseRef.current;
      }

      const registration = (async () => {
        if (!Device.isDevice || Platform.OS === "web") {
          setState("unavailable");
          return;
        }
        if (Platform.OS === "android") {
          await Notifications.setNotificationChannelAsync(
            "intouch-activity-v2",
            {
              name: "InTouch activity",
              importance: Notifications.AndroidImportance.HIGH,
              vibrationPattern: [0, 180, 120, 180],
            },
          );
        }
        const permissions = await Notifications.getPermissionsAsync();
        const granted =
          permissions.granted ||
          permissions.ios?.status ===
            Notifications.IosAuthorizationStatus.PROVISIONAL;
        if (!granted) {
          const requested = await Notifications.requestPermissionsAsync();
          if (!requested.granted) {
            setState("blocked");
            return;
          }
        }
        const easProjectId = projectId();
        if (!easProjectId) {
          setState("unavailable");
          return;
        }
        const [installationId, token] = await Promise.all([
          pushDeviceStore.getInstallationId(),
          Notifications.getExpoPushTokenAsync({
            projectId: easProjectId,
            ...(devicePushToken ? { devicePushToken } : {}),
          }),
        ]);
        await pushApi.register(installationId, {
          expoPushToken: token.data,
          platform: Platform.OS === "ios" ? "IOS" : "ANDROID",
        });
        if (user) {
          await AsyncStorage.removeItem(`${DISABLED_KEY_PREFIX}.${user.id}`);
        }
        setState("enabled");
      })();

      registrationPromiseRef.current = registration;
      const clearRegistration = () => {
        if (registrationPromiseRef.current === registration) {
          registrationPromiseRef.current = null;
        }
      };
      void registration.then(clearRegistration, clearRegistration);
      return registration;
    },
    [user],
  );

  const disable = useCallback(async () => {
    const installationId = await pushDeviceStore.getInstallationId();
    await pushApi.remove(installationId);
    if (user) {
      await AsyncStorage.setItem(`${DISABLED_KEY_PREFIX}.${user.id}`, "1");
    }
    await Notifications.setBadgeCountAsync(0).catch(() => false);
    setState("disabled");
  }, [user]);

  useEffect(() => {
    if (status !== "authenticated" || !user) {
      setState(status === "loading" ? "checking" : "disabled");
      return;
    }
    let cancelled = false;
    void (async () => {
      const disabled = await AsyncStorage.getItem(
        `${DISABLED_KEY_PREFIX}.${user.id}`,
      );
      const prompted = await AsyncStorage.getItem(
        `${PROMPT_KEY_PREFIX}.${user.id}`,
      );
      if (cancelled) return;
      if (disabled) {
        setState("disabled");
        return;
      }
      const permissions = await Notifications.getPermissionsAsync();
      if (permissions.granted) {
        await register().catch(() => setState("unavailable"));
        return;
      }
      setState(permissions.canAskAgain ? "disabled" : "blocked");
      if (prompted || !permissions.canAskAgain) return;
      await AsyncStorage.setItem(`${PROMPT_KEY_PREFIX}.${user.id}`, "1");
      Alert.alert(
        "Stay in the loop",
        "Enable notifications for invitations, direct messages, and reactions. Message text is never shown on the lock screen.",
        [
          { text: "Not now", style: "cancel" },
          { text: "Enable", onPress: () => void register() },
        ],
      );
    })().catch(() => setState("unavailable"));
    return () => {
      cancelled = true;
    };
  }, [register, status, user]);

  useEffect(() => {
    if (status !== "authenticated") return;
    const received = Notifications.addNotificationReceivedListener(() => {
      void queryClient.invalidateQueries({ queryKey: ["notifications"] });
      void reconcileBadge();
    });
    const response = Notifications.addNotificationResponseReceivedListener(
      (event) => {
        void openPushData(
          event.notification.request.content.data ?? {},
          setActiveOrganizationId,
        );
        void queryClient.invalidateQueries({ queryKey: ["notifications"] });
        void reconcileBadge();
      },
    );
    const token = Notifications.addPushTokenListener((devicePushToken) => {
      void register(devicePushToken).catch(() => setState("unavailable"));
    });
    void Notifications.getLastNotificationResponseAsync().then((last) => {
      if (!last) return;
      void openPushData(
        last.notification.request.content.data ?? {},
        setActiveOrganizationId,
      );
      void Notifications.clearLastNotificationResponseAsync();
    });
    const appState = AppState.addEventListener("change", (next) => {
      if (next === "active") {
        void reconcileBadge().catch(() => undefined);
      }
    });
    void reconcileBadge().catch(() => undefined);
    return () => {
      received.remove();
      response.remove();
      token.remove();
      appState.remove();
    };
  }, [queryClient, reconcileBadge, register, setActiveOrganizationId, status]);

  return (
    <PushContext.Provider value={{ disable, enable: register, state }}>
      {children}
    </PushContext.Provider>
  );
};

export const usePush = () => {
  const value = useContext(PushContext);
  if (!value) throw new Error("PushProvider is missing");
  return value;
};
