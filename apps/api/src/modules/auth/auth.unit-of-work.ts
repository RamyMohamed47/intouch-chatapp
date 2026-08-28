import mongoose from "mongoose";

import createMongooseUserRepository, {
  type AuthUserRepository,
} from "../user/user.repository.js";
import { createMongooseMailOutboxRepository } from "../mail/index.js";
import type { MailOutboxRepository } from "../mail/index.js";
import { createMongooseAuthActionTokenRepository } from "./auth.action-token.repository.js";
import type { AuthActionTokenRepository } from "./auth.action-token.repository.js";
import createMongooseAuthSessionRepository, {
  type AuthSessionRepository,
} from "./auth.repository.js";

export interface AuthWorkContext {
  sessions: AuthSessionRepository;
  users: AuthUserRepository;
  actionTokens: AuthActionTokenRepository;
  mailOutbox: MailOutboxRepository;
}

export interface AuthUnitOfWork {
  run<T>(work: (context: AuthWorkContext) => Promise<T>): Promise<T>;
}

const createMongooseAuthUnitOfWork = (): AuthUnitOfWork => ({
  run(work) {
    return mongoose.connection.transaction((session) =>
      work({
        actionTokens: createMongooseAuthActionTokenRepository(session),
        mailOutbox: createMongooseMailOutboxRepository(session),
        sessions: createMongooseAuthSessionRepository(session),
        users: createMongooseUserRepository(session),
      }),
    );
  },
});

export default createMongooseAuthUnitOfWork;
