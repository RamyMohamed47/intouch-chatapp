import ConflictError from "../../errors/ConflictError.js";
import NotFoundError from "../../errors/NotFoundError.js";

export class CategoryNotFoundError extends NotFoundError {
  constructor() {
    super("Category not found");
  }
}

export class CategoryConflictError extends ConflictError {
  constructor(message = "Category already exists") {
    super(message);
  }
}
