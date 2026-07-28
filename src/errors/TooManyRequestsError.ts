import AppError from "./AppError.js";

class TooManyRequestsError extends AppError {
  constructor(message = "Too many requests") {
    super(message, 429, "TOO_MANY_REQUESTS");
  }
}

export default TooManyRequestsError;
