import { diag, DiagConsoleLogger, DiagLogLevel } from "@opentelemetry/api";
import { getNodeAutoInstrumentations } from "@opentelemetry/auto-instrumentations-node";
import { OTLPMetricExporter } from "@opentelemetry/exporter-metrics-otlp-proto";
import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-proto";
import { resourceFromAttributes } from "@opentelemetry/resources";
import { NodeSDK } from "@opentelemetry/sdk-node";
import { PeriodicExportingMetricReader } from "@opentelemetry/sdk-metrics";
import {
  BatchSpanProcessor,
  ParentBasedSampler,
  TraceIdRatioBasedSampler,
  type Span,
  type SpanProcessor,
  type ReadableSpan,
} from "@opentelemetry/sdk-trace-base";
import {
  ATTR_DEPLOYMENT_ENVIRONMENT_NAME,
  ATTR_SERVICE_INSTANCE_ID,
  ATTR_SERVICE_NAME,
  ATTR_SERVICE_VERSION,
} from "@opentelemetry/semantic-conventions";
import type { Context } from "@opentelemetry/api";

import type { ObservabilityConfig } from "../../config/env.js";
import { closeObservabilityMetrics } from "./observability.metrics.js";
import { flushSentry, initializeSentry } from "./observability.sentry.js";

const sensitiveSpanAttributes = new Set([
  "db.statement",
  "db.query.text",
  "http.request.body",
  "http.request.header.authorization",
  "http.request.header.cookie",
  "http.response.header.set_cookie",
  "messaging.message.body",
  "url.query",
]);

const sanitizeUrlAttribute = (
  attributes: Record<string, unknown>,
  key: string,
) => {
  const value = attributes[key];
  if (typeof value !== "string") return;
  try {
    const url = new URL(value, "http://intouch.invalid");
    url.search = "";
    url.hash = "";
    attributes[key] = value.startsWith("http")
      ? url.toString()
      : `${url.pathname}`;
  } catch {
    attributes[key] = value.split(/[?#]/, 1)[0];
  }
};

class PrivacySpanProcessor implements SpanProcessor {
  constructor(private readonly delegate: SpanProcessor) {}

  forceFlush() {
    return this.delegate.forceFlush();
  }

  onStart(span: Span, parentContext: Context) {
    this.delegate.onStart(span, parentContext);
  }

  onEnding(span: Span) {
    const attributes = span.attributes as Record<string, unknown>;
    for (const key of sensitiveSpanAttributes) delete attributes[key];
    sanitizeUrlAttribute(attributes, "http.url");
    sanitizeUrlAttribute(attributes, "http.target");
    sanitizeUrlAttribute(attributes, "url.full");
    this.delegate.onEnding?.(span);
  }

  onEnd(span: ReadableSpan) {
    this.delegate.onEnd(span);
  }

  shutdown() {
    return this.delegate.shutdown();
  }
}

let sdk: NodeSDK | undefined;
let closed = false;

const exporterOrigin = (
  config: Extract<ObservabilityConfig, { provider: "otlp" }>,
) => new URL(config.endpoint).origin;

export const initializeObservability = (config: ObservabilityConfig) => {
  initializeSentry(config);
  if (config.provider === "disabled") return;

  diag.setLogger(new DiagConsoleLogger(), DiagLogLevel.ERROR);
  const origin = exporterOrigin(config);
  const spanProcessor = new PrivacySpanProcessor(
    new BatchSpanProcessor(new OTLPTraceExporter()),
  );
  sdk = new NodeSDK({
    resource: resourceFromAttributes({
      [ATTR_DEPLOYMENT_ENVIRONMENT_NAME]:
        process.env.RAILWAY_ENVIRONMENT_NAME ??
        process.env.NODE_ENV ??
        "development",
      [ATTR_SERVICE_INSTANCE_ID]:
        process.env.RAILWAY_REPLICA_ID ?? process.pid.toString(),
      [ATTR_SERVICE_NAME]: config.serviceName,
      [ATTR_SERVICE_VERSION]:
        process.env.RAILWAY_GIT_COMMIT_SHA ?? "development",
      "intouch.railway.deployment.id":
        process.env.RAILWAY_DEPLOYMENT_ID ?? "local",
    }),
    instrumentations: [
      getNodeAutoInstrumentations({
        "@opentelemetry/instrumentation-dns": { enabled: false },
        "@opentelemetry/instrumentation-fs": { enabled: false },
        "@opentelemetry/instrumentation-http": {
          ignoreIncomingRequestHook: (request) =>
            request.url === "/health" || request.url === "/ready",
          ignoreOutgoingRequestHook: (request) => {
            const protocol = request.protocol ?? "http:";
            const host = request.host;
            if (!host) return false;
            try {
              return new URL(`${protocol}//${host}`).origin === origin;
            } catch {
              return false;
            }
          },
        },
      }),
    ],
    metricReaders: [
      new PeriodicExportingMetricReader({
        exporter: new OTLPMetricExporter(),
        exportIntervalMillis: 30_000,
      }),
    ],
    sampler: new ParentBasedSampler({
      root: new TraceIdRatioBasedSampler(config.sampleRatio),
    }),
    spanProcessors: [spanProcessor],
  });
  sdk.start();
};

export const shutdownObservability = async () => {
  if (closed) return;
  closed = true;
  closeObservabilityMetrics();
  await Promise.allSettled([sdk?.shutdown(), flushSentry()]);
};
