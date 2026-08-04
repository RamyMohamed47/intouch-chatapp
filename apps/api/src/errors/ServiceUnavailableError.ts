import AppError from "./AppError.js";

class ServiceUnavailableError extends AppError {
  constructor(message = "Service unavailable") {
    super(message, 503, "SERVICE_UNAVAILABLE");
  }
}

export default ServiceUnavailableError;
