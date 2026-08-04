import mongoose from "mongoose";

import createMongooseUserRepository, {
  type UserRepository,
} from "../user/user.repository.js";
import createMongooseAuthSessionRepository, {
  type AuthSessionRepository,
} from "./auth.repository.js";

export interface AuthWorkContext {
  sessions: AuthSessionRepository;
  users: UserRepository;
}

export interface AuthUnitOfWork {
  run<T>(work: (context: AuthWorkContext) => Promise<T>): Promise<T>;
}

const createMongooseAuthUnitOfWork = (): AuthUnitOfWork => ({
  run(work) {
    return mongoose.connection.transaction((session) =>
      work({
        sessions: createMongooseAuthSessionRepository(session),
        users: createMongooseUserRepository(session),
      }),
    );
  },
});

export default createMongooseAuthUnitOfWork;
