import { resend } from "../../config/resend.js";
import { smtpTransport } from "../../config/mailer.js";
import { env } from "../../config/env.js";
import { logger } from "../../utils/logger.js";
import {
  buildPostPurchaseEmail,
  type PostPurchaseInput,
} from "./templates/post-purchase.js";

// Unified send helper — uses SMTP when USE_SMTP=true, otherwise Resend
async function sendEmail(to: string, subject: string, html: string, text?: string) {
  if (env.USE_SMTP && smtpTransport) {
    const info = await smtpTransport.sendMail({
      from: env.RESEND_FROM_EMAIL,
      to,
      subject,
      html,
      text,
    });
    logger.info(`SMTP email sent to ${to} (messageId: ${info.messageId})`);
    return;
  }

  const { data, error } = await resend.emails.send({
    from: env.RESEND_FROM_EMAIL,
    to,
    subject,
    html,
    text,
  });
  if (error) {
    logger.error(`Resend API error to ${to}: ${error.name} - ${error.message}`);
  } else {
    logger.info(`Resend email sent to ${to} (id: ${data?.id})`);
  }
}

export const sendVerificationEmail = async (
  email: string,
  token: string
): Promise<void> => {
  const verifyUrl = `${env.FRONTEND_PORTAL_URL}/verify-email?token=${token}`;

  try {
    await sendEmail(
      email,
      "Verify your AnyImmi account",
      `
        <div style="font-family: Inter, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #0F2B46;">Welcome to AnyImmi!</h2>
          <p>Please verify your email address by clicking the button below:</p>
          <a href="${verifyUrl}" style="display: inline-block; background: #0F2B46; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin: 16px 0;">Verify Email</a>
          <p style="color: #475569; font-size: 13px;">Or copy this link: ${verifyUrl}</p>
          <p style="color: #94A3B8; font-size: 12px;">If you didn't create an account, you can ignore this email.</p>
        </div>
      `
    );
  } catch (err) {
    logger.error(`Failed to send verification email to ${email}`, err);
  }
};

export const sendPasswordResetEmail = async (
  email: string,
  token: string
): Promise<void> => {
  const resetUrl = `${env.FRONTEND_PORTAL_URL}/reset-password?token=${token}`;

  try {
    await sendEmail(
      email,
      "Reset your AnyImmi password",
      `
        <div style="font-family: Inter, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #0F2B46;">Password Reset</h2>
          <p>You requested a password reset. Click the button below to set a new password:</p>
          <a href="${resetUrl}" style="display: inline-block; background: #0F2B46; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin: 16px 0;">Reset Password</a>
          <p style="color: #475569; font-size: 13px;">This link expires in 1 hour.</p>
          <p style="color: #94A3B8; font-size: 12px;">If you didn't request this, you can ignore this email.</p>
        </div>
      `
    );
  } catch (err) {
    logger.error(`Failed to send password reset email to ${email}`, err);
  }
};

export const sendWelcomeEmail = async ({
  email,
  name,
  tier,
  tempPassword,
}: {
  email: string;
  name: string;
  tier: string;
  tempPassword?: string;
}): Promise<void> => {
  const portalUrl = env.FRONTEND_PORTAL_URL;

  const tierContent: Record<string, string> = {
    starter: `
      <p><strong>Your Starter Bundle includes:</strong></p>
      <ul>
        <li>227+ digital assets (all 17 categories)</li>
        <li>1,000+ PSD design files</li>
        <li>3 months FREE AnyImmi Portal Pro access</li>
        <li>Lifetime bundle updates</li>
      </ul>
      <p>Your Google Drive access link will be emailed shortly.</p>
    `,
    custom: `
      <p><strong>Your Custom Branded Bundle includes:</strong></p>
      <ul>
        <li>Everything in Starter</li>
        <li>Custom branding on all key templates</li>
        <li>50 customized social media designs</li>
        <li>6 months FREE AnyImmi Portal Pro access</li>
      </ul>
      <p>You'll receive a branding intake form within 24 hours. Delivery: 1-3 business days after intake.</p>
    `,
    ultimate: `
      <p><strong>Your Ultimate Launch Kit includes:</strong></p>
      <ul>
        <li>Everything in Custom Branded</li>
        <li>Done-for-you professional website</li>
        <li>12 months FREE AnyImmi Portal Pro access</li>
        <li>1-on-1 onboarding call (30 min)</li>
        <li>VIP support for 6 months</li>
      </ul>
      <p>You'll receive a branding intake form and onboarding call booking link within 24 hours.</p>
    `,
  };

  const passwordSection = tempPassword
    ? `
      <div style="background: #F0FDF4; border: 1px solid #BBF7D0; border-radius: 8px; padding: 16px; margin: 16px 0;">
        <p style="margin: 0 0 8px; font-weight: 600; color: #166534;">Your Portal Login Credentials</p>
        <p style="margin: 0; color: #15803D;">Email: <strong>${email}</strong></p>
        <p style="margin: 0; color: #15803D;">Temporary Password: <strong>${tempPassword}</strong></p>
        <p style="margin: 8px 0 0; font-size: 12px; color: #166534;">Please change your password after first login from Settings.</p>
      </div>
    `
    : `
      <p>To log in later, use the "Forgot Password" link on the login page to set your password:</p>
    `;

  try {
    await sendEmail(
      email,
      `Welcome to AnyImmi, ${name}! Your bundle is ready.`,
      `
        <div style="font-family: Inter, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #0F2B46;">Thank you for your purchase, ${name}!</h2>
          ${tierContent[tier] || tierContent.starter}
          <hr style="border: 1px solid #E2E8F0; margin: 24px 0;" />
          <h3 style="color: #0F2B46;">Access the AnyImmi Portal</h3>
          <p>Your Portal Pro access is now active. You've been automatically logged in after purchase.</p>
          ${passwordSection}
          <a href="${portalUrl}" style="display: inline-block; background: #0F2B46; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin: 16px 0;">Go to Portal</a>
          <p style="color: #94A3B8; font-size: 12px;">Questions? Reply to this email or message us on WhatsApp.</p>
        </div>
      `
    );
  } catch (err) {
    logger.error(`Failed to send welcome email to ${email}`, err);
  }
};

const TIER_DISPLAY: Record<string, string> = {
  starter: "Starter Bundle",
  custom: "Custom Branded Bundle",
  ultimate: "Ultimate Launch Kit",
  portal_pro: "Portal Pro Subscription",
  portal_business: "Portal Business Subscription",
};

export const sendInvoiceEmail = async ({
  email,
  name,
  invoiceNumber,
  tier,
  amount,
  currency,
  portalProMonths,
  date,
  stripePaymentIntent,
}: {
  email: string;
  name: string;
  invoiceNumber: string;
  tier: string;
  amount: number;
  currency: string;
  portalProMonths: number;
  date: Date;
  stripePaymentIntent?: string;
}): Promise<void> => {
  const formattedDate = date.toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
  const formattedAmount = new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currency || "usd",
  }).format(amount);
  const tierName = TIER_DISPLAY[tier] || tier;

  const proRow =
    portalProMonths > 0
      ? `
        <tr>
          <td style="padding: 10px 12px; font-size: 13px; color: #334155; border-bottom: 1px solid #F1F5F9;">Portal Pro Access (${portalProMonths} months)</td>
          <td style="padding: 10px 12px; font-size: 13px; color: #059669; text-align: right; border-bottom: 1px solid #F1F5F9;">Included</td>
        </tr>
      `
      : "";

  try {
    await sendEmail(
      email,
      `Invoice ${invoiceNumber} — AnyImmi`,
      `
        <div style="font-family: Inter, Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #ffffff;">
          <!-- Header -->
          <div style="background: #0F2B46; padding: 24px 32px; border-radius: 8px 8px 0 0;">
            <table width="100%" cellpadding="0" cellspacing="0"><tr>
              <td><span style="font-size: 20px; font-weight: 700; color: #ffffff;">AnyImmi</span></td>
              <td style="text-align: right;"><span style="font-size: 22px; font-weight: 700; color: #ffffff;">INVOICE</span></td>
            </tr></table>
          </div>

          <div style="padding: 32px;">
            <!-- Invoice meta -->
            <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom: 24px;"><tr>
              <td style="vertical-align: top;">
                <p style="margin: 0 0 4px; font-size: 11px; color: #94A3B8; text-transform: uppercase;">Bill To</p>
                <p style="margin: 0 0 2px; font-size: 14px; font-weight: 600; color: #1E293B;">${name}</p>
                <p style="margin: 0; font-size: 13px; color: #64748B;">${email}</p>
              </td>
              <td style="text-align: right; vertical-align: top;">
                <p style="margin: 0 0 4px; font-size: 12px; color: #64748B;">Invoice: <strong style="color: #1E293B;">${invoiceNumber}</strong></p>
                <p style="margin: 0 0 4px; font-size: 12px; color: #64748B;">Date: <strong style="color: #1E293B;">${formattedDate}</strong></p>
                <p style="margin: 0;">
                  <span style="display: inline-block; background: #ECFDF5; color: #059669; font-size: 11px; font-weight: 600; padding: 2px 10px; border-radius: 12px;">PAID</span>
                </p>
              </td>
            </tr></table>

            <!-- Line items -->
            <table width="100%" cellpadding="0" cellspacing="0" style="border: 1px solid #E2E8F0; border-radius: 8px; overflow: hidden; margin-bottom: 20px;">
              <tr style="background: #F8FAFC;">
                <th style="padding: 10px 12px; font-size: 11px; color: #64748B; text-align: left; text-transform: uppercase; font-weight: 600;">Description</th>
                <th style="padding: 10px 12px; font-size: 11px; color: #64748B; text-align: right; text-transform: uppercase; font-weight: 600;">Amount</th>
              </tr>
              <tr>
                <td style="padding: 10px 12px; font-size: 13px; color: #334155; border-bottom: 1px solid #F1F5F9;">${tierName}</td>
                <td style="padding: 10px 12px; font-size: 13px; color: #334155; text-align: right; border-bottom: 1px solid #F1F5F9;">${formattedAmount}</td>
              </tr>
              ${proRow}
              <tr style="background: #F8FAFC;">
                <td style="padding: 12px; font-size: 14px; font-weight: 700; color: #0F2B46;">Total</td>
                <td style="padding: 12px; font-size: 14px; font-weight: 700; color: #0F2B46; text-align: right;">${formattedAmount} ${currency.toUpperCase()}</td>
              </tr>
            </table>

            <!-- Payment info -->
            ${
              stripePaymentIntent
                ? `<p style="margin: 0 0 16px; font-size: 12px; color: #94A3B8;">Payment Ref: ${stripePaymentIntent}</p>`
                : ""
            }

            <div style="background: #F8FAFC; border-radius: 8px; padding: 16px; text-align: center;">
              <p style="margin: 0; font-size: 13px; color: #64748B;">Thank you for your purchase! This invoice serves as your receipt.</p>
              <p style="margin: 8px 0 0; font-size: 12px; color: #94A3B8;">No payment is due.</p>
            </div>
          </div>

          <!-- Footer -->
          <div style="background: #F8FAFC; padding: 16px 32px; border-radius: 0 0 8px 8px; text-align: center;">
            <p style="margin: 0; font-size: 11px; color: #94A3B8;">AnyImmi — Digital Assets for Immigration Consultants</p>
          </div>
        </div>
      `
    );
  } catch (err) {
    logger.error(`Failed to send invoice email to ${email}`, err);
  }
};

export const sendPostPurchaseEmail = async (
  input: PostPurchaseInput & { email: string }
): Promise<void> => {
  const { email, ...rest } = input;
  const built = buildPostPurchaseEmail(rest);
  try {
    await sendEmail(email, built.subject, built.html, built.text);
  } catch (err) {
    logger.error(`Failed to send post-purchase email to ${email}`, err);
  }
};

export const sendPortalWelcomeEmail = async (
  email: string,
  name: string
): Promise<void> => {
  try {
    await sendEmail(
      email,
      `Welcome to the AnyImmi Portal, ${name}!`,
      `
        <div style="font-family: Inter, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #0F2B46;">Welcome to AnyImmi Portal!</h2>
          <p>Hi ${name}, your free account is ready. Here's what you can do:</p>
          <ul>
            <li>Browse 227+ immigration templates</li>
            <li>Try our AI tools (5 free generations/month)</li>
            <li>Save your favorite assets</li>
          </ul>
          <a href="${env.FRONTEND_PORTAL_URL}/dashboard" style="display: inline-block; background: #0F2B46; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin: 16px 0;">Go to Dashboard</a>
          <p style="color: #475569; font-size: 13px;">Upgrade to Pro for unlimited AI generations and full downloads.</p>
        </div>
      `
    );
  } catch (err) {
    logger.error(`Failed to send portal welcome email to ${email}`, err);
  }
};
