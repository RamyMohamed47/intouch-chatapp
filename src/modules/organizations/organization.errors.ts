import ConflictError from "../../errors/ConflictError.js";
import ForbiddenError from "../../errors/ForbiddenError.js";
import NotFoundError from "../../errors/NotFoundError.js";

export class OrganizationNotFoundError extends NotFoundError {
  constructor() {
    super("Organization not found");
  }
}

export class OrganizationForbiddenError extends ForbiddenError {
  constructor() {
    super("You do not have permission to modify this organization");
  }
}

export class OrganizationConflictError extends ConflictError {
  constructor(message = "Organization could not be created") {
    super(message);
  }
}
