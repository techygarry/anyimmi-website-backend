/**
 * Post-purchase "dopamine" email (V2 Marketing Phase 1 · §11 #19).
 *
 * Pure builder — returns { subject, html, text } so callers can plug into
 * Resend, SMTP, or the existing email.service sendEmail() helper.
 */

export type PostPurchaseTier = 'toolkit' | 'firm' | 'founder';

export interface PostPurchaseInput {
  name: string;
  tier: PostPurchaseTier;
  amountPaid: number; // dollars (e.g. 147, 397, 697)
  orderId: string;
}

export interface BuiltEmail {
  subject: string;
  html: string;
  text: string;
}

const TIER_BULLETS: Record<PostPurchaseTier, string[]> = {
  toolkit: [
    'You unlocked: 305 ready-to-use assets · 4 free AI tools · Lifetime updates',
    'Every PSD, AI, PDF, and calculator is yours to edit forever',
    'You still have 24 hours to upgrade to THE FIRM or THE FOUNDER at the difference in price',
    "Our triple guarantee has your back — if you don't save 20 hours in 30 days, full refund",
  ],
  firm: [
    'You unlocked: everything in TOOLKIT + your custom branding (delivered in 1-3 days) + 50 social media designs',
    "We'll email your branding intake form within 24 hours — fill it once, we do the rest",
    'Letterhead, business card, email signature, and brand guide all arriving in your firm colors',
    'You still have 24 hours to upgrade to THE FOUNDER for the website, Vault, and 90 free days of AI Tools + CRM + DOSSIAR',
  ],
  founder: [
    'You unlocked: everything in FIRM + done-for-you website + Million Dollar Vault + 90 days FREE access to AI Tools, CRM, and DOSSIAR + 1-on-1 onboarding call',
    'Your 90-day trial of AI Tools + CRM + DOSSIAR starts right now — $621 retail, free for you',
    "We'll reach out in 24 hours to book your founder onboarding call (45 min, founder direct)",
    'Lifetime grandfathering is locked in — whatever the price becomes, yours never changes',
  ],
};

const TIER_DISPLAY: Record<PostPurchaseTier, string> = {
  toolkit: 'THE TOOLKIT',
  firm: 'THE FIRM',
  founder: 'THE FOUNDER',
};

function libraryUrl(): string {
  if (process.env.NODE_ENV === 'development') {
    return 'http://localhost:3000/library';
  }
  return 'https://app.anyimmi.com/library';
}

export function buildPostPurchaseEmail(input: PostPurchaseInput): BuiltEmail {
  const { name, tier, amountPaid, orderId } = input;
  const bullets = TIER_BULLETS[tier];
  const tierDisplay = TIER_DISPLAY[tier];
  const cta = libraryUrl();
  const amountFmt = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(amountPaid);

  const subject = `Welcome inside, ${name} — here's why this was the right call`;

  const bulletHtml = bullets
    .map(
      (b) =>
        `<li style="margin: 0 0 14px; padding-left: 8px; font-size: 15px; color: #334155; line-height: 1.6;">${b}</li>`
    )
    .join('');

  const html = `<!doctype html>
<html>
  <body style="margin:0; padding:0; background:#F8FAFC; font-family: Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif;">
    <div style="max-width: 600px; margin: 0 auto; background: #ffffff;">

      <!-- Header -->
      <div style="background: linear-gradient(135deg, #0F172A 0%, #1E3A5F 100%); padding: 36px 32px;">
        <div style="font-size: 12px; letter-spacing: 2px; color: #818CF8; text-transform: uppercase; font-weight: 700; margin-bottom: 10px;">You're in · ${tierDisplay}</div>
        <h1 style="margin: 0; font-size: 26px; color: #ffffff; font-weight: 800; line-height: 1.3; letter-spacing: -0.3px;">
          Welcome inside, ${name}.
        </h1>
        <p style="margin: 12px 0 0; color: rgba(248,250,252,0.8); font-size: 15px; line-height: 1.5;">
          Here's why this was the right call.
        </p>
      </div>

      <!-- Body -->
      <div style="padding: 32px;">
        <p style="margin: 0 0 24px; font-size: 16px; color: #0F172A; line-height: 1.6;">
          You paid <strong>${amountFmt}</strong>. Most RCICs spend that on one half-finished brochure from a freelancer. Here's what you actually get:
        </p>

        <ul style="list-style: none; padding: 0; margin: 0 0 28px;">
          ${bulletHtml}
        </ul>

        <!-- CTA -->
        <div style="text-align: center; margin: 32px 0 20px;">
          <a href="${cta}"
             style="display: inline-block; padding: 16px 36px; background: linear-gradient(135deg, #4F46E5 0%, #7C3AED 100%); color: #ffffff; text-decoration: none; border-radius: 10px; font-weight: 700; font-size: 16px; letter-spacing: 0.2px; box-shadow: 0 10px 24px rgba(79,70,229,0.3);">
            Open your library →
          </a>
        </div>

        <div style="margin: 24px 0 0; padding: 16px; background: #F0FDF4; border: 1px solid #BBF7D0; border-radius: 10px; font-size: 13px; color: #14532D; line-height: 1.55;">
          <strong style="color:#065F46;">Your order reference:</strong> ${orderId}<br/>
          Keep this for your records. Your invoice email arrives separately.
        </div>
      </div>

      <!-- Footer -->
      <div style="background: #F8FAFC; padding: 20px 32px; text-align: center; border-top: 1px solid #E2E8F0;">
        <p style="margin: 0; font-size: 12px; color: #94A3B8;">
          AnyImmi · Built by RCICs, for RCICs.<br/>
          Reply to this email any time — founder@anyimmi.com reads every one.
        </p>
      </div>

    </div>
  </body>
</html>`;

  const textLines = [
    `Welcome inside, ${name}.`,
    '',
    `Here's why this was the right call. You paid ${amountFmt} for ${tierDisplay}:`,
    '',
    ...bullets.map((b) => `  • ${b}`),
    '',
    `Open your library: ${cta}`,
    '',
    `Order reference: ${orderId}`,
    '',
    'AnyImmi — Built by RCICs, for RCICs.',
    'Reply to this email any time — founder@anyimmi.com reads every one.',
  ];
  const text = textLines.join('\n');

  return { subject, html, text };
}
