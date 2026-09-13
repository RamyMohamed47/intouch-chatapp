import { CallPushEventType } from "@intouch/shared/push";
import * as Notifications from "expo-notifications";
import * as TaskManager from "expo-task-manager";

const CALL_PUSH_TASK = "intouch-call-push-v1";

if (!TaskManager.isTaskDefined(CALL_PUSH_TASK)) {
  TaskManager.defineTask<Notifications.NotificationTaskPayload>(
    CALL_PUSH_TASK,
    async ({ data }) => {
      if (
        !("actionIdentifier" in data) &&
        data.data.type === CallPushEventType.STATE_CHANGED
      ) {
        const callId = data.data.callId;
        if (typeof callId === "string") {
          const presented =
            await Notifications.getPresentedNotificationsAsync();
          await Promise.all(
            presented
              .filter(
                (notification) =>
                  notification.request.content.data?.callId === callId,
              )
              .map((notification) =>
                Notifications.dismissNotificationAsync(
                  notification.request.identifier,
                ),
              ),
          );
        }
      }
      return Notifications.BackgroundNotificationTaskResult.NoData;
    },
  );
}

void Notifications.registerTaskAsync(CALL_PUSH_TASK).catch(() => undefined);
