import AppError from "../../errors/AppError.js";

export class AiNotEnabledError extends AppError {
  constructor() {
    super("AI is not enabled for this organization", 403, "AI_NOT_ENABLED");
  }
}

export class AiConsentRequiredError extends AppError {
  constructor() {
    super(
      "Accept the AI data-use disclosure before continuing",
      403,
      "AI_CONSENT_REQUIRED",
    );
  }
}

export class AiContextUnavailableError extends AppError {
  constructor() {
    super(
      "AI workspace context is temporarily unavailable",
      503,
      "AI_CONTEXT_UNAVAILABLE",
    );
  }
}

export class AiUnavailableError extends AppError {
  constructor(message = "The AI assistant is temporarily unavailable") {
    super(message, 503, "AI_UNAVAILABLE");
  }
}

export class AiResponseBlockedError extends AppError {
  constructor() {
    super(
      "The AI provider could not generate a response for this request",
      400,
      "AI_RESPONSE_BLOCKED",
    );
  }
}

export class AiQuotaExceededError extends AppError {
  retryAfterSeconds: number;

  constructor(message: string, retryAfterSeconds: number) {
    super(message, 429, "TOO_MANY_REQUESTS");
    this.retryAfterSeconds = retryAfterSeconds;
  }
}
