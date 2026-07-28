import AppError from "./AppError.js";

class ConflictError extends AppError {
  constructor(message = "Resource conflict") {
    super(message, 409, "CONFLICT");
  }
}

export default ConflictError;
