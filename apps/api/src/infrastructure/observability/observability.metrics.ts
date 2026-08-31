import {
  metrics,
  type Attributes,
  type Counter,
  type Histogram,
} from "@opentelemetry/api";
import { monitorEventLoopDelay, type IntervalHistogram } from "node:perf_hooks";

type ReadinessCheck = () => boolean;
type QueueDepthCheck = () => Promise<Record<string, number>>;

const activityRoutes = new Map<string, string>([
  ["POST /api/v1/auth/login", "auth.login"],
  ["POST /api/v1/auth/register", "auth.register"],
  [
    "POST /api/v1/organizations/:organizationId/direct-messages",
    "direct_message.create",
  ],
  ["POST /api/v1/conversations/:conversationId/messages", "message.create"],
  ["POST /api/v1/organizations/:id/invitations", "invitation.create"],
  ["POST /api/v1/uploads", "upload.create"],
  ["GET /api/v1/organizations/:organizationId/search", "search.execute"],
  ["PUT /api/v1/messages/:messageId/reactions/me", "reaction.set"],
  ["DELETE /api/v1/messages/:messageId/reactions/me", "reaction.remove"],
]);

const statusClass = (statusCode: number) => `${Math.floor(statusCode / 100)}xx`;

class InTouchMetrics {
  readonly httpActive;
  readonly httpDuration: Histogram;
  readonly httpRequests: Counter;
  readonly activities: Counter;
  readonly realtimeConnections: Counter;
  readonly realtimeEvents: Counter;
  readonly providerOperations: Counter;
  readonly providerDuration: Histogram;
  readonly backgroundJobs: Counter;
  readonly backgroundJobDuration: Histogram;

  private readonly readinessChecks = new Map<string, ReadinessCheck>();
  private readonly queueDepthChecks = new Map<string, QueueDepthCheck>();
  private readonly eventLoop: IntervalHistogram;

  constructor() {
    const meter = metrics.getMeter("intouch-api");
    this.httpActive = meter.createUpDownCounter(
      "intouch.http.server.active_requests",
      {
        description: "Currently active API requests",
      },
    );
    this.httpDuration = meter.createHistogram("intouch.http.server.duration", {
      description: "API request duration",
      unit: "s",
    });
    this.httpRequests = meter.createCounter("intouch.http.server.requests", {
      description: "Completed API requests",
    });
    this.activities = meter.createCounter("intouch.activity.requests", {
      description: "Safe aggregate application activity requests",
    });
    this.realtimeConnections = meter.createCounter(
      "intouch.realtime.connections",
      { description: "Socket connection outcomes" },
    );
    this.realtimeEvents = meter.createCounter("intouch.realtime.events", {
      description: "Socket event outcomes",
    });
    this.providerOperations = meter.createCounter(
      "intouch.provider.operations",
      {
        description: "External provider operation outcomes",
      },
    );
    this.providerDuration = meter.createHistogram("intouch.provider.duration", {
      description: "External provider operation duration",
      unit: "s",
    });
    this.backgroundJobs = meter.createCounter(
      "intouch.background_jobs.processed",
      {
        description: "Background job outcomes",
      },
    );
    this.backgroundJobDuration = meter.createHistogram(
      "intouch.background_jobs.duration",
      {
        description: "Background job processing duration",
        unit: "s",
      },
    );

    meter
      .createObservableGauge("intouch.background_jobs.queue_depth", {
        description: "BullMQ jobs by queue state",
      })
      .addCallback(async (result) => {
        for (const [queue, check] of this.queueDepthChecks) {
          try {
            const counts = await check();
            for (const [state, count] of Object.entries(counts)) {
              result.observe(count, { queue, state });
            }
          } catch {
            // Queue readiness already reports outages; metrics collection is best effort.
          }
        }
      });

    meter
      .createObservableGauge("intouch.runtime.memory", {
        description: "Node.js process memory",
        unit: "By",
      })
      .addCallback((result) => {
        const usage = process.memoryUsage();
        result.observe(usage.rss, { kind: "rss" });
        result.observe(usage.heapUsed, { kind: "heap_used" });
        result.observe(usage.heapTotal, { kind: "heap_total" });
        result.observe(usage.external, { kind: "external" });
      });

    meter
      .createObservableGauge("intouch.runtime.cpu", {
        description: "Cumulative Node.js process CPU time",
        unit: "s",
      })
      .addCallback((result) => {
        const usage = process.cpuUsage();
        result.observe(usage.user / 1_000_000, { kind: "user" });
        result.observe(usage.system / 1_000_000, { kind: "system" });
      });

    meter
      .createObservableGauge("intouch.runtime.uptime", {
        description: "Node.js process uptime",
        unit: "s",
      })
      .addCallback((result) => result.observe(process.uptime()));

    meter
      .createObservableGauge("intouch.dependency.ready", {
        description: "Critical dependency readiness",
      })
      .addCallback((result) => {
        for (const [dependency, check] of this.readinessChecks) {
          result.observe(check() ? 1 : 0, { dependency });
        }
      });

    this.eventLoop = monitorEventLoopDelay({ resolution: 20 });
    this.eventLoop.enable();
    meter
      .createObservableGauge("intouch.runtime.event_loop_delay", {
        description: "Node.js event-loop delay percentiles",
        unit: "s",
      })
      .addCallback((result) => {
        result.observe(this.eventLoop.percentile(50) / 1_000_000_000, {
          quantile: "0.5",
        });
        result.observe(this.eventLoop.percentile(95) / 1_000_000_000, {
          quantile: "0.95",
        });
        result.observe(this.eventLoop.percentile(99) / 1_000_000_000, {
          quantile: "0.99",
        });
      });
  }

  registerReadiness(dependency: string, check: ReadinessCheck) {
    this.readinessChecks.set(dependency, check);
  }

  registerBackgroundQueue(queue: string, check: QueueDepthCheck) {
    this.queueDepthChecks.set(queue, check);
    return () => this.queueDepthChecks.delete(queue);
  }

  recordHttpRequest(input: {
    durationSeconds: number;
    method: string;
    route: string;
    statusCode: number;
  }) {
    const attributes = {
      method: input.method,
      route: input.route,
      status_class: statusClass(input.statusCode),
    } satisfies Attributes;
    this.httpRequests.add(1, attributes);
    this.httpDuration.record(input.durationSeconds, attributes);

    const activity = activityRoutes.get(`${input.method} ${input.route}`);
    if (activity) {
      this.activities.add(1, {
        activity,
        result: input.statusCode < 400 ? "success" : "failure",
      });
    }
  }

  recordRealtimeConnection(result: "accepted" | "rejected" | "closed") {
    this.realtimeConnections.add(1, { result });
  }

  recordRealtimeEvent(event: string, result: "accepted" | "rejected") {
    this.realtimeEvents.add(1, { event, result });
  }

  recordProviderOperation(input: {
    durationSeconds: number;
    operation: string;
    provider: string;
    result: "success" | "failure";
  }) {
    const attributes = {
      operation: input.operation,
      provider: input.provider,
      result: input.result,
    } satisfies Attributes;
    this.providerOperations.add(1, attributes);
    this.providerDuration.record(input.durationSeconds, attributes);
  }

  recordBackgroundJob(input: {
    durationSeconds: number;
    job: string;
    queue: string;
    result: "completed" | "failed";
  }) {
    const attributes = {
      job: input.job,
      queue: input.queue,
      result: input.result,
    } satisfies Attributes;
    this.backgroundJobs.add(1, attributes);
    this.backgroundJobDuration.record(input.durationSeconds, attributes);
  }

  close() {
    this.eventLoop.disable();
  }
}

let singleton: InTouchMetrics | undefined;

export const getObservabilityMetrics = () => {
  singleton ??= new InTouchMetrics();
  return singleton;
};

export const closeObservabilityMetrics = () => {
  singleton?.close();
};
