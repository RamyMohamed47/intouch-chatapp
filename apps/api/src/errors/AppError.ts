import type { ErrorCodeValue } from "@intouch/shared/common";

export type ErrorCode = ErrorCodeValue;

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
