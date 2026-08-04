import NotFoundError from "../../errors/NotFoundError.js";

export class DirectMessageRecipientNotFoundError extends NotFoundError {
  constructor() {
    super("Direct message recipient not found");
  }
}
