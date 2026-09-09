import * as Sentry from "@sentry/react-native";

import { mobileConfig } from "@/core/config";
import {
  sanitizeSentryRecord,
  sanitizeSentryText,
} from "@/core/monitoring/sentry-sanitizer";

export const navigationIntegration = Sentry.reactNavigationIntegration({
  enableTimeToInitialDisplay: false,
});

Sentry.init({
  dsn: mobileConfig.sentryDsn,
  enabled: Boolean(mobileConfig.sentryDsn),
  sendDefaultPii: false,
  tracesSampleRate: 0,
  enableAutoSessionTracking: false,
  integrations: [navigationIntegration],
  beforeSend(event) {
    delete event.user;
    if (event.request) {
      delete event.request.data;
      delete event.request.cookies;
      delete event.request.headers;
      if (event.request.url) {
        event.request.url = sanitizeSentryText(event.request.url);
      }
    }
    if (event.extra) event.extra = sanitizeSentryRecord(event.extra);
    if (event.breadcrumbs) {
      event.breadcrumbs = event.breadcrumbs.map((breadcrumb) => ({
        ...breadcrumb,
        ...(breadcrumb.message
          ? { message: sanitizeSentryText(breadcrumb.message) }
          : {}),
        ...(breadcrumb.data
          ? { data: sanitizeSentryRecord(breadcrumb.data) }
          : {}),
      }));
    }
    return event;
  },
});

export const captureNetworkFailure = (input: {
  error: unknown;
  path: string;
  status?: number;
}) => {
  if (!mobileConfig.sentryDsn) return;
  Sentry.withScope((scope) => {
    scope.setTag("failure.kind", "network");
    if (input.status !== undefined) {
      scope.setTag("http.status_code", String(input.status));
    }
    scope.setContext("request", { path: input.path.split("?")[0] });
    Sentry.captureException(
      input.error instanceof Error
        ? new Error(input.error.name)
        : new Error("Mobile network failure"),
    );
  });
};

export { Sentry };
