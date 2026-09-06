import mongoose from "mongoose";

import createMongooseAiRepository, {
  type AiRepository,
} from "./ai.repository.js";

export interface AiUnitOfWork {
  run<T>(work: (repository: AiRepository) => Promise<T>): Promise<T>;
}

const createMongooseAiUnitOfWork = (): AiUnitOfWork => ({
  run(work) {
    return mongoose.connection.transaction((session) =>
      work(createMongooseAiRepository(session)),
    );
  },
});

export default createMongooseAiUnitOfWork;
