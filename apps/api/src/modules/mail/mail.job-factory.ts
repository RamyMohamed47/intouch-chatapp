import type { MailPayloadCipher } from "./mail.crypto.js";
import {
  MailKind,
  type CreateMailOutboxInput,
  type MailOutboxJobFactory,
  type MailPayload,
} from "./mail.types.js";

const createMailOutboxJobFactory = (
  cipher: MailPayloadCipher,
  now: () => Date = () => new Date(),
): MailOutboxJobFactory => {
  const create = (
    aggregateKey: string,
    payload: MailPayload,
    expiresAt: Date,
  ): CreateMailOutboxInput => ({
    aggregateKey,
    kind: payload.kind,
    ...cipher.encrypt(payload),
    availableAt: now(),
    expiresAt,
  });

  return {
    verification(input) {
      return create(
        `auth-verification:${input.userId}`,
        {
          kind: MailKind.EMAIL_VERIFICATION,
          to: input.email,
          displayName: input.displayName,
          token: input.token,
        },
        input.expiresAt,
      );
    },

    passwordReset(input) {
      return create(
        `auth-reset:${input.userId}`,
        {
          kind: MailKind.PASSWORD_RESET,
          to: input.email,
          displayName: input.displayName,
          token: input.token,
        },
        input.expiresAt,
      );
    },

    organizationInvitation(input) {
      return create(
        `organization:${input.organizationId}:invitation:${input.invitationId}`,
        {
          kind: MailKind.ORGANIZATION_INVITATION,
          to: input.email,
          displayName: input.displayName,
          organizationName: input.organizationName,
          inviterName: input.inviterName,
        },
        input.expiresAt,
      );
    },
  };
};

export default createMailOutboxJobFactory;
