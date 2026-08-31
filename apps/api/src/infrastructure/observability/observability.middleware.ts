import type { Request, RequestHandler } from "express";

import { getObservabilityMetrics } from "./observability.metrics.js";

const routePattern = (req: Request) => {
  const route = req.route as { path?: unknown } | undefined;
  if (typeof route?.path === "string") {
    return `${req.baseUrl}${route.path}` || "/";
  }
  if (req.path === "/health" || req.path === "/ready") return req.path;
  return "unmatched";
};

export const createObservabilityMiddleware = (): RequestHandler => {
  const metrics = getObservabilityMetrics();

  return (req, res, next) => {
    const startedAt = process.hrtime.bigint();
    metrics.httpActive.add(1, { method: req.method });

    res.once("finish", () => {
      const durationSeconds =
        Number(process.hrtime.bigint() - startedAt) / 1_000_000_000;
      metrics.httpActive.add(-1, { method: req.method });
      metrics.recordHttpRequest({
        durationSeconds,
        method: req.method,
        route: routePattern(req),
        statusCode: res.statusCode,
      });
    });

    next();
  };
};

export { routePattern as getNormalizedRoute };
