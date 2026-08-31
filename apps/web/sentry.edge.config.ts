import * as Sentry from "@sentry/nextjs";

import {
  sanitizeSentryBreadcrumb,
  sanitizeSentryEvent,
} from "@/lib/observability/sentry";

Sentry.init({
  beforeBreadcrumb: sanitizeSentryBreadcrumb,
  beforeSend: sanitizeSentryEvent,
  dsn: process.env.SENTRY_DSN ?? process.env.NEXT_PUBLIC_SENTRY_DSN,
  enabled: Boolean(
    process.env.SENTRY_DSN ?? process.env.NEXT_PUBLIC_SENTRY_DSN,
  ),
  environment: process.env.RAILWAY_ENVIRONMENT_NAME ?? process.env.NODE_ENV,
  release: process.env.RAILWAY_GIT_COMMIT_SHA,
  sendDefaultPii: false,
  tracesSampleRate: process.env.NODE_ENV === "production" ? 0.1 : 0,
});
