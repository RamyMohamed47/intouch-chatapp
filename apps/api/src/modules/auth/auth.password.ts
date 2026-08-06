import bcrypt from "bcryptjs";

import type { PasswordHasher } from "./auth.types.js";

const BCRYPT_COST = 12;
const DUMMY_PASSWORD_HASH =
  "$2b$12$lUL/2gOV7rsf/oRhG8HpheiCe5krUqnbT0pr0YpmMhC208J3RSp4K";

export const createBcryptPasswordHasher = (): PasswordHasher => ({
  hash(password) {
    return bcrypt.hash(password, BCRYPT_COST);
  },

  compare(password, passwordHash) {
    return bcrypt.compare(password, passwordHash);
  },

  compareDummy(password) {
    return bcrypt.compare(password, DUMMY_PASSWORD_HASH);
  },
});
