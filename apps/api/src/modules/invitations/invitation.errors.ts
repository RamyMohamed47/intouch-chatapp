import ConflictError from "../../errors/ConflictError.js";
import NotFoundError from "../../errors/NotFoundError.js";

export class InvitationNotFoundError extends NotFoundError {
  constructor() {
    super("Invitation not found");
  }
}

export class InvitationTargetNotFoundError extends NotFoundError {
  constructor() {
    super("Invited user not found");
  }
}

export class InvitationConflictError extends ConflictError {
  constructor(message = "A pending invitation already exists") {
    super(message);
  }
}
