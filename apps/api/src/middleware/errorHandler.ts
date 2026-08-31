import type { ErrorRequestHandler, Response } from "express";
import { errorResponseSchema } from "@intouch/shared/common";

import { getLogger } from "../config/logger.js";
import type { ErrorCode } from "../errors/AppError.js";
import ValidationError from "../errors/ValidationError.js";
import { getNormalizedRoute } from "../infrastructure/observability/observability.middleware.js";
import { captureUnexpectedError } from "../infrastructure/observability/observability.sentry.js";

interface OperationalError extends Error {
  code?: ErrorCode;
  statusCode?: number;
  isOperational?: boolean;
  retryAfterSeconds?: number;
}

interface ValidationErrorLike extends Error {
  name: "ValidationError";
  errors: Record<string, { message: string }>;
}

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

const isValidationError = (err: unknown): err is ValidationErrorLike =>
  isObject(err) &&
  err.name === "ValidationError" &&
  isObject(err.errors) &&
  Object.values(err.errors).every(
    (error) => isObject(error) && typeof error.message === "string",
  );

const toOperationalError = (err: unknown): OperationalError => {
  if (err instanceof Error) {
    return err;
  }

  return new Error("Something went wrong");
};

const getValidationErrorMessage = (err: ValidationErrorLike) =>
  Object.values(err.errors)
    .map((error) => error.message)
    .join(". ");

const sendError = (err: OperationalError, res: Response) => {
  const statusCode = err.statusCode ?? 500;
  const isOperational = err.isOperational === true;
  const code = isOperational ? err.code : "INTERNAL_SERVER_ERROR";
  const message = isOperational ? err.message : "Something went wrong";

  if (
    isOperational &&
    Number.isFinite(err.retryAfterSeconds) &&
    (err.retryAfterSeconds ?? 0) > 0
  ) {
    res.set("Retry-After", String(Math.ceil(err.retryAfterSeconds ?? 1)));
  }

  res.status(statusCode).json(
    errorResponseSchema.parse({
      success: false,
      error: {
        code: code ?? "INTERNAL_SERVER_ERROR",
        message,
      },
    }),
  );
};

export const shouldCaptureError = (error: OperationalError) =>
  error.isOperational !== true || (error.statusCode ?? 500) >= 500;

const handleError: ErrorRequestHandler = (err, req, res, next) => {
  if (res.headersSent) {
    next(err);
    return;
  }

  const error: OperationalError = isValidationError(err)
    ? new ValidationError(getValidationErrorMessage(err))
    : toOperationalError(err);

  if (process.env.NODE_ENV !== "test") {
    const logger = getLogger();
    if (shouldCaptureError(error)) {
      logger.error({ err: error }, "Request failed");
    } else if ((error.statusCode ?? 500) === 429) {
      logger.warn({ code: error.code }, "Request rate limited");
    } else {
      logger.info(
        { code: error.code, statusCode: error.statusCode },
        "Request rejected",
      );
    }
  }

  if (shouldCaptureError(error)) {
    captureUnexpectedError(error, {
      method: req.method,
      request_id: String(res.getHeader("X-Request-Id") ?? "unknown"),
      route: getNormalizedRoute(req),
      status_code: error.statusCode ?? 500,
    });
  }

  sendError(error, res);
};

export default handleError;
