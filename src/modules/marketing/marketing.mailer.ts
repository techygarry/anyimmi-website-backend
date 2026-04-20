import { resend } from "../../config/resend.js";
import { smtpTransport } from "../../config/mailer.js";
import { env } from "../../config/env.js";
import { logger } from "../../utils/logger.js";

/**
 * Send a marketing email using SMTP (local dev) or Resend (production).
 * Mirrors the pattern used in email.service.ts.
 */
export async function sendMarketingEmail(to: string, subject: string, html: string) {
  if (env.USE_SMTP && smtpTransport) {
    const info = await smtpTransport.sendMail({
      from: env.RESEND_FROM_EMAIL,
      to,
      subject,
      html,
    });
    logger.info(`SMTP marketing email sent to ${to} (messageId: ${info.messageId})`);
    return;
  }

  const { data, error } = await resend.emails.send({
    from: env.RESEND_FROM_EMAIL,
    to,
    subject,
    html,
  });
  if (error) {
    throw new Error(`Resend error: ${error.name} - ${error.message}`);
  }
  logger.info(`Resend marketing email sent to ${to} (id: ${data?.id})`);
}
