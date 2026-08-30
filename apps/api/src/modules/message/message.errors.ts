import ConflictError from "../../errors/ConflictError.js";
import ForbiddenError from "../../errors/ForbiddenError.js";
import NotFoundError from "../../errors/NotFoundError.js";
import ValidationError from "../../errors/ValidationError.js";

export class MessageNotFoundError extends NotFoundError {
  constructor() {
    super("Message not found");
  }
}

export class MessageForbiddenError extends ForbiddenError {
  constructor(message = "You do not have permission to modify this message") {
    super(message);
  }
}

export class MessageConflictError extends ConflictError {
  constructor(message = "Deleted messages cannot be edited") {
    super(message);
  }
}

export class MessageValidationError extends ValidationError {
  constructor(message: string) {
    super(message);
  }
}
