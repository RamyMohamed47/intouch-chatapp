import AppError from "../../errors/AppError.js";
import ConflictError from "../../errors/ConflictError.js";
import ForbiddenError from "../../errors/ForbiddenError.js";
import NotFoundError from "../../errors/NotFoundError.js";

export class VoiceSessionActiveError extends AppError {
  constructor() {
    super(
      "Leave your current voice session before joining another",
      409,
      "VOICE_SESSION_ACTIVE",
    );
  }
}

export class VoiceUserBusyError extends AppError {
  constructor() {
    super("This person is unavailable for a call", 409, "VOICE_USER_BUSY");
  }
}

export class VoiceCapacityError extends AppError {
  constructor() {
    super("This voice channel is full", 409, "VOICE_CAPACITY_REACHED");
  }
}

export class VoiceUnavailableError extends AppError {
  constructor() {
    super("Voice service is unavailable", 503, "VOICE_UNAVAILABLE");
  }
}

export class CallNotFoundError extends NotFoundError {
  constructor() {
    super("Call not found");
  }
}

export class CallForbiddenError extends ForbiddenError {
  constructor() {
    super("You cannot perform this call action");
  }
}

export class CallConflictError extends ConflictError {
  constructor(message = "Call cannot perform that transition") {
    super(message);
  }
}
