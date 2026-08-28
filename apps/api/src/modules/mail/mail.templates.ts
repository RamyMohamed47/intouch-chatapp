import { MailKind, type MailPayload, type RenderedMail } from "./mail.types.js";

const escapeHtml = (value: string) =>
  value.replace(/[&<>'"]/g, (character) => {
    const entities: Record<string, string> = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      "'": "&#39;",
      '"': "&quot;",
    };
    return entities[character] ?? character;
  });

const page = (content: string) => `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"></head>
<body style="margin:0;background:#07101f;color:#eef5ff;font-family:Arial,sans-serif">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="padding:32px 16px;background:#07101f"><tr><td align="center">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:560px;border:1px solid #20365a;border-radius:24px;background:#0d1b31;padding:36px">
<tr><td style="font-size:24px;font-weight:700;padding-bottom:24px"><span style="color:#ff9418">In</span><span style="color:#2f9dff">Touch</span></td></tr>
<tr><td style="font-size:16px;line-height:1.65;color:#d7e4f7">${content}</td></tr>
<tr><td style="padding-top:28px;font-size:12px;color:#8fa4c2">Connect. Communicate. Together.</td></tr>
</table></td></tr></table></body></html>`;

const action = (label: string, url: string) =>
  `<p style="margin:28px 0"><a href="${escapeHtml(url)}" style="display:inline-block;border-radius:12px;background:#2f9dff;color:#06101f;padding:13px 20px;text-decoration:none;font-weight:700">${escapeHtml(label)}</a></p><p style="font-size:12px;word-break:break-all;color:#8fa4c2">${escapeHtml(url)}</p>`;

export const createMailRenderer = (webAppUrl: string) => {
  const baseUrl = webAppUrl.replace(/\/$/, "");

  return (payload: MailPayload): RenderedMail => {
    const name = escapeHtml(payload.displayName);

    switch (payload.kind) {
      case MailKind.EMAIL_VERIFICATION: {
        const url = `${baseUrl}/verify-email#token=${encodeURIComponent(payload.token)}`;
        return {
          to: payload.to,
          subject: "Confirm your InTouch email",
          text: `Hi ${payload.displayName}, confirm your InTouch email within 24 hours: ${url}`,
          html: page(
            `<h1 style="margin:0 0 16px;font-size:28px">Confirm your email</h1><p>Hi ${name},</p><p>Confirm this email address to activate your InTouch account. This link expires in 24 hours.</p>${action("Confirm email", url)}<p>If you did not create this account, you can ignore this message.</p>`,
          ),
        };
      }
      case MailKind.PASSWORD_RESET: {
        const url = `${baseUrl}/reset-password#token=${encodeURIComponent(payload.token)}`;
        return {
          to: payload.to,
          subject: "Reset your InTouch password",
          text: `Hi ${payload.displayName}, reset your InTouch password within 15 minutes: ${url}`,
          html: page(
            `<h1 style="margin:0 0 16px;font-size:28px">Reset your password</h1><p>Hi ${name},</p><p>Use the link below to choose a new InTouch password. This link expires in 15 minutes and can be used once.</p>${action("Reset password", url)}<p>If you did not request this, you can ignore this message.</p>`,
          ),
        };
      }
      case MailKind.ORGANIZATION_INVITATION: {
        const url = `${baseUrl}/app/invitations`;
        return {
          to: payload.to,
          subject: `You were invited to ${payload.organizationName} on InTouch`,
          text: `${payload.inviterName} invited you to ${payload.organizationName} on InTouch. Review it within seven days: ${url}`,
          html: page(
            `<h1 style="margin:0 0 16px;font-size:28px">You have an invitation</h1><p>Hi ${name},</p><p><strong>${escapeHtml(payload.inviterName)}</strong> invited you to join <strong>${escapeHtml(payload.organizationName)}</strong> on InTouch.</p>${action("Review invitation", url)}<p>Sign in with this email address to accept or decline. The invitation expires after seven days.</p>`,
          ),
        };
      }
    }
  };
};

export type MailRenderer = ReturnType<typeof createMailRenderer>;
