# Observability

InTouch uses three complementary production signals:

- Railway captures structured API logs and container resource metrics.
- Grafana Cloud receives OpenTelemetry metrics and sampled traces over OTLP.
- Sentry receives sanitized unexpected API and web errors with private source
  maps.

Telemetry is optional in development and never participates in readiness.
Exporter or Sentry outages must not reject application requests or make
`/ready` fail.

## Health Semantics

- `GET /health` is process liveness. Railway should not use it to decide
  whether a replica can receive traffic.
- `GET /ready` checks MongoDB, Redis runtime state, and BullMQ. Railway should
  use this path as the API health check.
- Grafana Cloud, Sentry, Mailpit, and the local LGTM container are deliberately
  excluded from readiness.

There is no public Prometheus `/metrics` route. Production telemetry leaves the
API through authenticated OTLP export.

## Local Metrics And Traces

Start the optional Grafana LGTM container alongside the normal infrastructure:

```bash
npm run observability:up
```

Apply these values to the ignored `apps/api/config.env`:

```dotenv
OBSERVABILITY_PROVIDER=otlp
OTEL_EXPORTER_OTLP_ENDPOINT=http://127.0.0.1:4318
OTEL_SERVICE_NAME=intouch-api
OTEL_TRACES_SAMPLER_ARG=1
```

Restart the API and open Grafana at `http://localhost:3002`. The bundled
`InTouch / API Overview` and `InTouch / Realtime and Providers` dashboards are
provisioned automatically. Local traces use a sampling ratio of `1` only to
make manual testing predictable.

Useful lifecycle commands:

```bash
npm run observability:status
npm run observability:logs
npm run observability:down
```

The LGTM container is disposable and has no persistent volume. MongoDB and
Redis volumes are unaffected.

## Grafana Cloud

Create a Grafana Cloud stack and obtain the OTLP endpoint and authentication
header from its OpenTelemetry connection instructions. Configure the Railway
API service:

```dotenv
OBSERVABILITY_PROVIDER=otlp
OTEL_EXPORTER_OTLP_ENDPOINT=https://<grafana-otlp-host>
OTEL_EXPORTER_OTLP_HEADERS=Authorization=Basic <grafana-instance-and-token>
OTEL_SERVICE_NAME=intouch-api
OTEL_TRACES_SAMPLER_ARG=0.1
```

Production requires HTTPS and a nonempty OTLP header. The 10 percent ratio
applies to root traces; parent sampling decisions are preserved. Import the
JSON dashboards from `observability/grafana/dashboards` into the cloud stack.

The custom metric vocabulary is deliberately bounded:

- `intouch.http.server.*`: normalized route, method, and status class.
- `intouch.activity.requests`: aggregate named product actions only.
- `intouch.realtime.connections` and `intouch.realtime.events`: admission
  outcomes without socket, user, organization, or conversation identifiers.
- `intouch.provider.*`: mail, storage, and search provider outcomes and
  duration without payloads or object keys.
- `intouch.background_jobs.*`: bounded queue depth, job outcomes, and worker
  duration without BullMQ job IDs or payloads.
- `intouch.runtime.*`: process memory, CPU time, uptime, and event-loop delay.
- `intouch.dependency.ready`: binary MongoDB, Redis, and background-job state.

Do not add user IDs, emails, filenames, message content, search text, tokens,
query strings, bucket keys, or presigned URLs as metric labels or span
attributes. High-cardinality identifiers belong only in tightly controlled
logs when already permitted by the domain's logging policy.

## Sentry

Create separate Sentry projects for `intouch-api` and `intouch-web`. Configure
the API Railway service with its API project values:

```dotenv
SENTRY_DSN=https://<api-project-dsn>
SENTRY_ORG=<organization-slug>
SENTRY_PROJECT=intouch-api
SENTRY_AUTH_TOKEN=<source-map-upload-token>
```

Configure the web Railway service with its web project values:

```dotenv
SENTRY_DSN=https://<web-project-dsn>
NEXT_PUBLIC_SENTRY_DSN=https://<web-project-dsn>
NEXT_PUBLIC_SENTRY_ENVIRONMENT=production
SENTRY_ORG=<organization-slug>
SENTRY_PROJECT=intouch-web
SENTRY_AUTH_TOKEN=<source-map-upload-token>
```

`SENTRY_AUTH_TOKEN` is build-only and must never have a `NEXT_PUBLIC_` prefix.
The API `build:api` command uploads private source maps using the Railway commit
SHA. The Next.js build uploads web source maps and deletes them from deployment
artifacts. Builds skip uploads when no Sentry settings are configured and fail
when only a partial upload configuration is supplied.

Sentry captures unexpected failures only. Expected validation,
authentication, authorization, conflict, not-found, and throttling responses
remain in structured logs and do not create error issues. Request query values,
headers, cookies, form data, arbitrary contexts, breadcrumb data, and PII are
removed before an event is sent. Only opaque authenticated user IDs may be
attached.

## Alerts And Synthetic Checks

Configure these initial Grafana Cloud alerts with email notifications:

| Signal | Suggested condition | Evaluation |
| --- | --- | --- |
| API error rate | 5xx requests exceed 5 percent with at least 10 requests | 5 minutes |
| API latency | p95 duration exceeds 1 second | 10 minutes |
| Dependency readiness | any `intouch_dependency_ready` series is `0` | 2 minutes |
| Event-loop delay | p95 exceeds 250 ms | 5 minutes |
| Provider failures | failure rate exceeds 5 percent with at least 5 operations | 10 minutes |

Voice telemetry uses bounded labels and never includes users, conversations,
provider room names, or credentials. Grafana receives
`intouch_voice_calls_total`, `intouch_voice_join_duration_seconds`,
`intouch_voice_active_sessions`, and `intouch_voice_channel_occupancy` after
OpenTelemetry Prometheus normalization. LiveKit operations also appear in the
existing provider operation and duration metrics with `provider=livekit`.

Use Railway's API health check for `/ready`. Add an external synthetic monitor
for `/health` and, if the monitor should verify dependencies, a second one for
`/ready`. Do not send alerts for a single failed probe; require at least two
consecutive failures. Never place credentials in synthetic URLs.

Create Sentry issue alerts for new regressions and repeated production errors.
Avoid duplicate alerting on expected 4xx responses because those events are not
captured.

## Incident Workflow

1. Confirm whether `/health` or `/ready` failed.
2. Check the Railway deployment and resource graphs.
3. Filter Railway JSON logs by `requestId`, `traceId`, or deployment metadata.
4. Follow the trace in Grafana using `traceId` when available.
5. Inspect the corresponding sanitized Sentry issue for stack context.
6. Confirm MongoDB, Redis, BullMQ, mail, storage, and search provider panels.

The frontend preserves `X-Request-Id` from API errors in `ApiError.requestId`,
so testers can provide the correlation value without exposing request content.
