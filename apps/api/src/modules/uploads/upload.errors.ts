import AppError from "../../errors/AppError.js";

export class UploadNotFoundError extends AppError {
  constructor() {
    super("Upload was not found", 404, "NOT_FOUND");
  }
}

export class UploadConflictError extends AppError {
  constructor(message = "Upload is not ready or has already been used") {
    super(message, 409, "CONFLICT");
  }
}

export class UploadValidationError extends AppError {
  constructor(message: string, statusCode = 400) {
    super(message, statusCode, "VALIDATION_ERROR");
  }
}

export class UploadQuotaExceededError extends AppError {
  retryAfterSeconds: number;

  constructor(retryAfterSeconds: number) {
    super("Daily upload quota exceeded", 429, "TOO_MANY_REQUESTS");
    this.retryAfterSeconds = retryAfterSeconds;
  }
}

export class OrganizationStorageLimitError extends AppError {
  constructor() {
    super("Organization storage limit reached", 409, "CONFLICT");
  }
}

export class StorageUnavailableError extends AppError {
  constructor(options?: ErrorOptions) {
    super(
      "File storage is temporarily unavailable",
      503,
      "STORAGE_UNAVAILABLE",
    );
    if (options?.cause !== undefined) this.cause = options.cause;
  }
}
