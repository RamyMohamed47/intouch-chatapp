export class UserIdentityConflictError extends Error {
  constructor(options?: ErrorOptions) {
    super("User identity conflict", options);
    this.name = new.target.name;
  }
}
