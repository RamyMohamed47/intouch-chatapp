import NotFoundError from "../../errors/NotFoundError.js";
import ValidationError from "../../errors/ValidationError.js";

export class NotificationNotFoundError extends NotFoundError {
  constructor() {
    super("Notification not found");
  }
}

export class NotificationCursorError extends ValidationError {
  constructor() {
    super("Notification cursor is invalid");
  }
}
