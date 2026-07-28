import AppError from "./AppError.js";

class TooManyRequestsError extends AppError {
  constructor(message = "Too many requests") {
    super(message, 429);
  }
}

export default TooManyRequestsError;
