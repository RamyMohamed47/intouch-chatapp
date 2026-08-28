import nodemailer from "nodemailer";

import type { MailTransport } from "./mail.types.js";

export interface SmtpMailConfig {
  host: string;
  port: number;
  secure: boolean;
  requireTls: boolean;
  user: string;
  password: string;
  fromName: string;
  fromAddress: string;
}

export const createSmtpMailTransport = (
  config: SmtpMailConfig,
): MailTransport => {
  const transporter = nodemailer.createTransport({
    pool: true,
    maxConnections: 2,
    maxMessages: 100,
    host: config.host,
    port: config.port,
    secure: config.secure,
    requireTLS: config.requireTls,
    auth: { user: config.user, pass: config.password },
    connectionTimeout: 15_000,
    greetingTimeout: 10_000,
    socketTimeout: 30_000,
  });

  return {
    async send(mail) {
      const result = await transporter.sendMail({
        from: { name: config.fromName, address: config.fromAddress },
        ...mail,
      });
      return { messageId: result.messageId };
    },
    close() {
      transporter.close();
    },
  };
};
