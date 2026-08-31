import type { Breadcrumb, ErrorEvent } from "@sentry/nextjs";

const sanitizeUrl = (value: string) => {
  try {
    const url = new URL(value, "http://intouch.invalid");
    url.search = "";
    url.hash = "";
    return value.startsWith("http") ? url.toString() : url.pathname;
  } catch {
    return value.split(/[?#]/, 1)[0] ?? value;
  }
};

export const sanitizeSentryEvent = (event: ErrorEvent): ErrorEvent => {
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
  delete event.contexts;
  delete event.extra;
  return event;
};

export const sanitizeSentryBreadcrumb = (
  breadcrumb: Breadcrumb,
): Breadcrumb => ({
  ...(breadcrumb.category ? { category: breadcrumb.category } : {}),
  ...(breadcrumb.level ? { level: breadcrumb.level } : {}),
  ...(breadcrumb.message ? { message: breadcrumb.message } : {}),
  ...(breadcrumb.timestamp ? { timestamp: breadcrumb.timestamp } : {}),
  ...(breadcrumb.type ? { type: breadcrumb.type } : {}),
});

export const sentryClientOptions = {
  beforeBreadcrumb: sanitizeSentryBreadcrumb,
  beforeSend: sanitizeSentryEvent,
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  enabled: Boolean(process.env.NEXT_PUBLIC_SENTRY_DSN),
  environment:
    process.env.NEXT_PUBLIC_SENTRY_ENVIRONMENT ?? process.env.NODE_ENV,
  sendDefaultPii: false,
  tracesSampleRate: process.env.NODE_ENV === "production" ? 0.1 : 0,
} as const;

export const setSentryUser = async (userId: string | null) => {
  if (!process.env.NEXT_PUBLIC_SENTRY_DSN) return;

  const { setUser } = await import("@sentry/nextjs");
  setUser(userId ? { id: userId } : null);
};
