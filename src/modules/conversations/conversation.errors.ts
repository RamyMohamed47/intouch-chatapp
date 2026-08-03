import ConflictError from "../../errors/ConflictError.js";
import ForbiddenError from "../../errors/ForbiddenError.js";
import NotFoundError from "../../errors/NotFoundError.js";

export class ConversationNotFoundError extends NotFoundError {
  constructor() {
    super("Conversation not found");
  }
}

export class ConversationForbiddenError extends ForbiddenError {
  constructor(message = "You do not have permission for this conversation") {
    super(message);
  }
}

export class ConversationConflictError extends ConflictError {
  constructor(message = "Conversation conflicts with existing data") {
    super(message);
  }
}

export class ParticipantNotFoundError extends NotFoundError {
  constructor() {
    super("Conversation participant not found");
  }
}

export class ParticipantConflictError extends ConflictError {
  constructor(message = "Conversation participant already exists") {
    super(message);
  }
}
