import * as Sentry from "@sentry/node";

import type { ObservabilityConfig } from "../../config/env.js";

type SafeContext = Record<string, boolean | number | string | undefined>;

const sanitizeUrl = (value: string) => {
  try {
    const url = new URL(value);
    url.search = "";
    url.hash = "";
    return url.toString();
  } catch {
    return value.split(/[?#]/, 1)[0] ?? value;
  }
};

const sanitizeEvent = (event: Sentry.ErrorEvent): Sentry.ErrorEvent => {
  if (event.request) {
    event.request = {
      ...(event.request.method ? { method: event.request.method } : {}),
      ...(event.request.url ? { url: sanitizeUrl(event.request.url) } : {}),
    };
  }
  if (event.user) {
    if (event.user.id) event.user = { id: String(event.user.id) };
    else delete event.user;
  }
  if (event.breadcrumbs) {
    event.breadcrumbs = event.breadcrumbs.map((breadcrumb) => ({
      ...(breadcrumb.category ? { category: breadcrumb.category } : {}),
      ...(breadcrumb.level ? { level: breadcrumb.level } : {}),
      ...(breadcrumb.message ? { message: breadcrumb.message } : {}),
      ...(breadcrumb.timestamp ? { timestamp: breadcrumb.timestamp } : {}),
      ...(breadcrumb.type ? { type: breadcrumb.type } : {}),
    }));
  }
  delete event.contexts;
  delete event.extra;
  return event;
};

let enabled = false;

export const initializeSentry = (config: ObservabilityConfig) => {
  if (!config.sentryDsn) return;

  Sentry.init({
    dsn: config.sentryDsn,
    defaultIntegrations: false,
    enabled: true,
    environment: process.env.RAILWAY_ENVIRONMENT_NAME ?? process.env.NODE_ENV,
    release: process.env.RAILWAY_GIT_COMMIT_SHA,
    sendDefaultPii: false,
    tracesSampleRate: 0,
    beforeSend: sanitizeEvent,
  });
  enabled = true;
};

export const captureUnexpectedError = (
  error: unknown,
  context: SafeContext = {},
) => {
  if (!enabled) return;

  Sentry.withScope((scope) => {
    for (const [key, value] of Object.entries(context)) {
      if (value !== undefined) scope.setTag(key, String(value));
    }
    Sentry.captureException(error);
  });
};

export const flushSentry = async (timeoutMs = 2_000) => {
  if (enabled) await Sentry.flush(timeoutMs);
};

export { sanitizeEvent as sanitizeSentryEvent };
