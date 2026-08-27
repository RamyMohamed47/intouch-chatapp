import ConflictError from "../../errors/ConflictError.js";

export class MessageReactionConflictError extends ConflictError {
  constructor() {
    super("Deleted messages cannot be reacted to");
  }
}
