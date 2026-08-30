export const MailKind = {
  EMAIL_VERIFICATION: "EMAIL_VERIFICATION",
  PASSWORD_RESET: "PASSWORD_RESET",
  ORGANIZATION_INVITATION: "ORGANIZATION_INVITATION",
} as const;

export type MailKindValue = (typeof MailKind)[keyof typeof MailKind];

export type MailPayload =
  | {
      kind: typeof MailKind.EMAIL_VERIFICATION;
      to: string;
      displayName: string;
      token: string;
    }
  | {
      kind: typeof MailKind.PASSWORD_RESET;
      to: string;
      displayName: string;
      token: string;
    }
  | {
      kind: typeof MailKind.ORGANIZATION_INVITATION;
      to: string;
      displayName: string;
      organizationName: string;
      inviterName: string;
    };

export interface EncryptedMailPayload {
  ciphertext: string;
  iv: string;
  authTag: string;
}

export interface CreateMailOutboxInput extends EncryptedMailPayload {
  aggregateKey: string;
  kind: MailKindValue;
  availableAt: Date;
  expiresAt: Date;
}

export interface MailOutboxRecord extends CreateMailOutboxInput {
  id: string;
  attempts: number;
  dispatchedAt?: Date;
}

export interface RenderedMail {
  to: string;
  subject: string;
  text: string;
  html: string;
}

export interface MailTransport {
  send(mail: RenderedMail): Promise<{ messageId?: string }>;
  close(): Promise<void> | void;
}

export interface MailOutboxJobFactory {
  verification(input: {
    userId: string;
    email: string;
    displayName: string;
    token: string;
    expiresAt: Date;
  }): CreateMailOutboxInput;
  passwordReset(input: {
    userId: string;
    email: string;
    displayName: string;
    token: string;
    expiresAt: Date;
  }): CreateMailOutboxInput;
  organizationInvitation(input: {
    organizationId: string;
    invitationId: string;
    email: string;
    displayName: string;
    organizationName: string;
    inviterName: string;
    expiresAt: Date;
  }): CreateMailOutboxInput;
}
