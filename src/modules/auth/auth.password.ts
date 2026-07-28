import bcrypt from "bcryptjs";

import type { PasswordHasher } from "./auth.types.js";

const BCRYPT_COST = 12;

export const createBcryptPasswordHasher = (): PasswordHasher => ({
  hash(password) {
    return bcrypt.hash(password, BCRYPT_COST);
  },

  compare(password, passwordHash) {
    return bcrypt.compare(password, passwordHash);
  },
});
