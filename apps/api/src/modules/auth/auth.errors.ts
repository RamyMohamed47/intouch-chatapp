import ConflictError from "../../errors/ConflictError.js";
import ServiceUnavailableError from "../../errors/ServiceUnavailableError.js";
import TooManyRequestsError from "../../errors/TooManyRequestsError.js";
import UnauthorizedError from "../../errors/UnauthorizedError.js";

export class DuplicateIdentityError extends ConflictError {
  constructor() {
    super("Email or username already exists");
  }
}

export class InvalidCredentialsError extends UnauthorizedError {
  constructor() {
    super("Invalid email or password");
  }
}

export class LoginAttemptsExceededError extends TooManyRequestsError {
  constructor() {
    super("Too many login attempts. Try again later.");
  }
}

export class InvalidRefreshTokenError extends UnauthorizedError {
  constructor() {
    super("Invalid or expired refresh token");
  }
}

export class InvalidGoogleAuthenticationError extends UnauthorizedError {
  constructor(options?: ErrorOptions) {
    super("Google authentication failed");

    if (options?.cause !== undefined) {
      this.cause = options.cause;
    }
  }
}

export class GoogleIdentityConflictError extends ConflictError {
  constructor() {
    super("Google account cannot be linked");
  }
}

export class GoogleProviderUnavailableError extends ServiceUnavailableError {
  constructor() {
    super("Google authentication is temporarily unavailable");
  }
}
