import type { Logger } from "pino";

import type { MailPayloadCipher } from "./mail.crypto.js";
import type { MailOutboxRepository } from "./mail.outbox.repository.js";
import type { MailRenderer } from "./mail.templates.js";
import type { MailOutboxRecord, MailTransport } from "./mail.types.js";

export const MAIL_LEASE_MS = 60_000;
export const MAIL_MAX_ATTEMPTS = 5;
export const MAIL_RETRY_DELAYS_MS = [
  30_000, 120_000, 300_000, 600_000,
] as const;

export interface MailDeliveryDependencies {
  cipher: MailPayloadCipher;
  logger: Logger;
  outbox: MailOutboxRepository;
  render: MailRenderer;
  transport: MailTransport;
  now: () => Date;
}

export const getMailErrorCode = (error: unknown) => {
  if (typeof error === "object" && error !== null && "code" in error) {
    const code = error.code;
    if (typeof code === "string") return code.slice(0, 80);
  }
  return "MAIL_DELIVERY_FAILED";
};

export const deliverClaimedMail = async (
  dependencies: MailDeliveryDependencies,
  job: MailOutboxRecord,
) => {
  const payload = dependencies.cipher.decrypt(job);
  if (payload.kind !== job.kind) {
    throw Object.assign(new Error("Mail payload kind mismatch"), {
      code: "INVALID_MAIL_PAYLOAD",
    });
  }
  const result = await dependencies.transport.send(
    dependencies.render(payload),
  );
  await dependencies.outbox.markSent(
    job.id,
    dependencies.now(),
    result.messageId,
  );
  dependencies.logger.info(
    { mailJobId: job.id, mailKind: job.kind, attempt: job.attempts },
    "Transactional email delivered",
  );
};
