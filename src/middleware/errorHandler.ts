import type { ErrorRequestHandler, Response } from "express";

import { getLogger } from "../config/logger.js";
import type { ErrorCode } from "../errors/AppError.js";
import ValidationError from "../errors/ValidationError.js";

interface OperationalError extends Error {
  code?: ErrorCode;
  statusCode?: number;
  isOperational?: boolean;
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

  res.status(statusCode).json({
    success: false,
    error: {
      code: code ?? "INTERNAL_SERVER_ERROR",
      message,
    },
  });
};

const handleError: ErrorRequestHandler = (err, _req, res, next) => {
  if (res.headersSent) {
    next(err);
    return;
  }

  const error: OperationalError = isValidationError(err)
    ? new ValidationError(getValidationErrorMessage(err))
    : toOperationalError(err);

  if (process.env.NODE_ENV !== "test") {
    getLogger().error({ err }, "Request failed");
  }

  sendError(error, res);
};

export default handleError;
