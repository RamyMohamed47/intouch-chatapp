import type { Logger } from "pino";

import type { MailPayloadCipher } from "./mail.crypto.js";
import type { MailOutboxRepository } from "./mail.outbox.repository.js";
import type { MailRenderer } from "./mail.templates.js";
import type { MailTransport } from "./mail.types.js";
import {
  deliverClaimedMail,
  getMailErrorCode,
  MAIL_LEASE_MS,
  MAIL_MAX_ATTEMPTS,
  MAIL_RETRY_DELAYS_MS,
} from "./mail.delivery.js";

const POLL_INTERVAL_MS = 2_000;

export const createMailOutboxWorker = (dependencies: {
  cipher: MailPayloadCipher;
  logger: Logger;
  outbox: MailOutboxRepository;
  render: MailRenderer;
  transport: MailTransport;
  now?: () => Date;
}) => {
  const now = dependencies.now ?? (() => new Date());
  let timer: NodeJS.Timeout | undefined;
  let active: Promise<void> | undefined;
  let stopping = false;

  const processOne = async () => {
    const currentTime = now();
    const job = await dependencies.outbox.claimNext(
      currentTime,
      new Date(currentTime.getTime() + MAIL_LEASE_MS),
    );
    if (!job) return;

    try {
      await deliverClaimedMail({ ...dependencies, now }, job);
    } catch (error) {
      const failedAt = now();
      const errorCode = getMailErrorCode(error);
      const retryDelay = MAIL_RETRY_DELAYS_MS[job.attempts - 1];
      const canRetry =
        job.attempts < MAIL_MAX_ATTEMPTS &&
        retryDelay !== undefined &&
        failedAt.getTime() + retryDelay < job.expiresAt.getTime();

      if (canRetry) {
        await dependencies.outbox.scheduleRetry(
          job.id,
          new Date(failedAt.getTime() + retryDelay),
          errorCode,
        );
      } else {
        await dependencies.outbox.markFailed(job.id, failedAt, errorCode);
      }

      dependencies.logger.warn(
        {
          mailJobId: job.id,
          mailKind: job.kind,
          attempt: job.attempts,
          retryScheduled: canRetry,
          errorCode,
        },
        "Transactional email delivery failed",
      );
    }
  };

  const pump = () => {
    if (stopping || active) return;
    active = processOne()
      .catch((error: unknown) => {
        dependencies.logger.error(
          { err: error },
          "Mail worker iteration failed",
        );
      })
      .finally(() => {
        active = undefined;
      });
  };

  return {
    runOnce: processOne,
    start() {
      if (timer) return;
      stopping = false;
      pump();
      timer = setInterval(pump, POLL_INTERVAL_MS);
      timer.unref();
    },
    async close() {
      stopping = true;
      if (timer) clearInterval(timer);
      timer = undefined;
      await active;
      await dependencies.transport.close();
    },
  };
};

export type MailOutboxWorker = ReturnType<typeof createMailOutboxWorker>;
