export type ErrorCode =
  | "VALIDATION_ERROR"
  | "UNAUTHORIZED"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "CONFLICT"
  | "TOO_MANY_REQUESTS"
  | "SERVICE_UNAVAILABLE"
  | "INTERNAL_SERVER_ERROR";

class AppError extends Error {
  code: ErrorCode;
  statusCode: number;
  isOperational: true;

  constructor(message: string, statusCode: number, code: ErrorCode) {
    super(message);

    this.name = new.target.name;
    this.code = code;
    this.statusCode = statusCode;
    this.isOperational = true;

    Error.captureStackTrace(this, this.constructor);
  }
}

export default AppError;
