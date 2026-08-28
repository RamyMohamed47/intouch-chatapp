import AppError from "../../errors/AppError.js";
import ValidationError from "../../errors/ValidationError.js";

export class SearchUnavailableError extends AppError {
  constructor() {
    super("Search is temporarily unavailable", 503, "SEARCH_UNAVAILABLE");
  }
}

export class SearchCursorError extends ValidationError {
  constructor() {
    super("Search cursor is invalid for this query");
  }
}

export class SearchPersistenceUnavailableError extends Error {
  constructor(options?: ErrorOptions) {
    super("Search persistence is unavailable", options);
    this.name = "SearchPersistenceUnavailableError";
  }
}
