import ConflictError from "../../errors/ConflictError.js";

export class MembershipConflictError extends ConflictError {
  constructor(message = "User is already an organization member") {
    super(message);
  }
}
