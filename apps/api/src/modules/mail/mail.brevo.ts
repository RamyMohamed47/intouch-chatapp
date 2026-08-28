import type { MailTransport } from "./mail.types.js";

const BREVO_TRANSACTIONAL_EMAIL_URL = "https://api.brevo.com/v3/smtp/email";
const DEFAULT_TIMEOUT_MS = 15_000;

type FetchImplementation = typeof globalThis.fetch;

export interface BrevoMailConfig {
  apiKey: string;
  fromAddress: string;
  fromName: string;
  endpoint?: string;
  timeoutMs?: number;
}

const createDeliveryError = (code: string, message: string) =>
  Object.assign(new Error(message), { code });

const readErrorCode = (error: unknown) => {
  if (typeof error !== "object" || error === null) return undefined;

  if ("code" in error && typeof error.code === "string") {
    return error.code;
  }
  if (
    "cause" in error &&
    typeof error.cause === "object" &&
    error.cause !== null &&
    "code" in error.cause &&
    typeof error.cause.code === "string"
  ) {
    return error.cause.code;
  }

  return undefined;
};

export const createBrevoMailTransport = (
  config: BrevoMailConfig,
  fetchImplementation: FetchImplementation = globalThis.fetch,
): MailTransport => ({
  async send(mail) {
    let response: Response;

    try {
      response = await fetchImplementation(
        config.endpoint ?? BREVO_TRANSACTIONAL_EMAIL_URL,
        {
          method: "POST",
          headers: {
            accept: "application/json",
            "api-key": config.apiKey,
            "content-type": "application/json",
          },
          body: JSON.stringify({
            sender: {
              email: config.fromAddress,
              name: config.fromName,
            },
            to: [{ email: mail.to }],
            subject: mail.subject,
            htmlContent: mail.html,
          }),
          signal: AbortSignal.timeout(config.timeoutMs ?? DEFAULT_TIMEOUT_MS),
        },
      );
    } catch (error) {
      const providerCode = readErrorCode(error);
      throw createDeliveryError(
        providerCode ? `BREVO_${providerCode}` : "BREVO_NETWORK_ERROR",
        "Brevo transactional email request failed",
      );
    }

    if (!response.ok) {
      throw createDeliveryError(
        `BREVO_HTTP_${response.status}`,
        "Brevo rejected the transactional email request",
      );
    }

    const body: unknown = await response.json().catch(() => undefined);
    if (
      typeof body !== "object" ||
      body === null ||
      !("messageId" in body) ||
      typeof body.messageId !== "string" ||
      body.messageId.length === 0
    ) {
      throw createDeliveryError(
        "BREVO_INVALID_RESPONSE",
        "Brevo returned an invalid transactional email response",
      );
    }

    return { messageId: body.messageId };
  },
  close() {},
});
