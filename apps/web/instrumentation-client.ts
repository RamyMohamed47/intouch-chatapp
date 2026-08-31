import * as Sentry from "@sentry/nextjs";

import { sentryClientOptions } from "@/lib/observability/sentry";

Sentry.init(sentryClientOptions);

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
