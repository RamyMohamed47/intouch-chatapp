import type { Logger } from "pino";

import type { MailPayloadCipher } from "./mail.crypto.js";
import type { MailOutboxRepository } from "./mail.outbox.repository.js";
import type { MailRenderer } from "./mail.templates.js";
import type { MailTransport } from "./mail.types.js";

const POLL_INTERVAL_MS = 2_000;
const LEASE_MS = 60_000;
const MAX_ATTEMPTS = 5;
const RETRY_DELAYS_MS = [30_000, 120_000, 300_000, 600_000] as const;

const getErrorCode = (error: unknown) => {
  if (typeof error === "object" && error !== null && "code" in error) {
    const code = error.code;
    if (typeof code === "string") return code.slice(0, 80);
  }
  return "MAIL_DELIVERY_FAILED";
};

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
      new Date(currentTime.getTime() + LEASE_MS),
    );
    if (!job) return;

    try {
      const payload = dependencies.cipher.decrypt(job);
      if (payload.kind !== job.kind) {
        throw Object.assign(new Error("Mail payload kind mismatch"), {
          code: "INVALID_MAIL_PAYLOAD",
        });
      }
      const result = await dependencies.transport.send(
        dependencies.render(payload),
      );
      await dependencies.outbox.markSent(job.id, now(), result.messageId);
      dependencies.logger.info(
        { mailJobId: job.id, mailKind: job.kind, attempt: job.attempts },
        "Transactional email delivered",
      );
    } catch (error) {
      const failedAt = now();
      const errorCode = getErrorCode(error);
      const retryDelay = RETRY_DELAYS_MS[job.attempts - 1];
      const canRetry =
        job.attempts < MAX_ATTEMPTS &&
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
