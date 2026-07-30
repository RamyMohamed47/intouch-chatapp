import type { RequestHandler } from "express";

import ValidationError from "../errors/ValidationError.js";

interface SafeParseSuccess<T> {
  success: true;
  data: T;
}

interface SafeParseFailure {
  success: false;
  error: {
    issues: readonly {
      path: readonly PropertyKey[];
      message: string;
    }[];
  };
}

interface RequestSchema<T> {
  safeParse(input: unknown): SafeParseSuccess<T> | SafeParseFailure;
}

const formatIssues = (issues: SafeParseFailure["error"]["issues"]) =>
  issues
    .map((issue) => {
      const path = issue.path.map(String).join(".");
      return path ? `${path}: ${issue.message}` : issue.message;
    })
    .join(". ");

const validate = <T>(
  schema: RequestSchema<T>,
  read: (request: Parameters<RequestHandler>[0]) => unknown,
  write: (request: Parameters<RequestHandler>[0], value: T) => void,
): RequestHandler =>
  function validateRequest(req, _res, next) {
    const result = schema.safeParse(read(req));

    if (!result.success) {
      next(new ValidationError(formatIssues(result.error.issues)));
      return;
    }

    write(req, result.data);
    next();
  };

export const validateBody = <T>(schema: RequestSchema<T>): RequestHandler =>
  validate(
    schema,
    (req) => req.body,
    (req, value) => {
      req.body = value;
    },
  );

export const validateParams = <T>(schema: RequestSchema<T>): RequestHandler =>
  validate(
    schema,
    (req) => req.params,
    (req, value) => {
      req.params = value as typeof req.params;
    },
  );
