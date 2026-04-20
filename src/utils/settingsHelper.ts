import { SiteSetting } from "../modules/admin/siteSetting.model.js";
import { env } from "../config/env.js";

// ─── Gemini Settings ────────────────────────────────────────

export async function getGeminiApiKey(): Promise<string> {
  const setting = await SiteSetting.findOne({ key: "gemini_api_key" });
  return (setting?.value as string) || env.GEMINI_API_KEY;
}

export async function getGeminiModel(): Promise<string> {
  const setting = await SiteSetting.findOne({ key: "gemini_model" });
  return (setting?.value as string) || "gemini-2.5-flash";
}

// ─── Firecrawl Settings ─────────────────────────────────────

export async function getFirecrawlApiKey(): Promise<string> {
  const setting = await SiteSetting.findOne({ key: "firecrawl_api_key" });
  return (setting?.value as string) || env.FIRECRAWL_API_KEY;
}

// ─── WhatsApp Settings ──────────────────────────────────────

export interface WhatsAppConfig {
  apiUrl: string;
  phoneNumberId: string;
  accessToken: string;
  templateName: string;
  templateLanguage: string;
}

export async function getWhatsAppConfig(): Promise<WhatsAppConfig> {
  const [apiUrl, phoneId, token, tplName, tplLang] = await Promise.all([
    SiteSetting.findOne({ key: "whatsapp_api_url" }),
    SiteSetting.findOne({ key: "whatsapp_phone_number_id" }),
    SiteSetting.findOne({ key: "whatsapp_access_token" }),
    SiteSetting.findOne({ key: "whatsapp_message_template_name" }),
    SiteSetting.findOne({ key: "whatsapp_message_template_language" }),
  ]);
  return {
    apiUrl: (apiUrl?.value as string) || env.WHATSAPP_API_URL,
    phoneNumberId: (phoneId?.value as string) || env.WHATSAPP_PHONE_NUMBER_ID,
    accessToken: (token?.value as string) || env.WHATSAPP_ACCESS_TOKEN,
    templateName: (tplName?.value as string) || "",
    templateLanguage: (tplLang?.value as string) || "en",
  };
}

// ─── Plan Types ─────────────────────────────────────────────

export interface BundlePlan {
  id: string;
  name: string;
  stripePriceId: string;
  price: number;
  valuePrice: number;
  portalProMonths: number;
  features: string[];
  delivery: string;
  highlight: boolean;
  active: boolean;
  /** Products unlocked for 90-day trial ONLY on the top tier */
  topTierEntitlements?: string[];
  /** Strikethrough anchor copy, e.g. "normally $14,997" */
  valueAnchor?: string;
  /** Identity line under the tier name */
  tagline?: string;
}

/** Legacy tier id -> new tier id (kept for old links, test envs, webhooks) */
const LEGACY_TIER_ALIASES: Record<string, string> = {
  starter: "toolkit",
  custom: "firm",
  ultimate: "founder",
};

export function resolveTierId(tier: string): string {
  return LEGACY_TIER_ALIASES[tier] ?? tier;
}

export interface PortalPlan {
  id: string;
  name: string;
  stripePriceId: string;
  price: number;
  interval: string;
  features: string[];
  active: boolean;
}

// ─── Default Plans (env fallback) ───────────────────────────

const DEFAULT_BUNDLE_PLANS: BundlePlan[] = [
  {
    id: "toolkit",
    name: "THE ESSENTIALS",
    stripePriceId: env.STRIPE_PRICE_STARTER,
    price: 197,
    valuePrice: 2685,
    portalProMonths: 0,
    tagline: "The goldmine of Canadian immigration assets.",
    valueAnchor: "normally $2,685",
    features: [
      "305 production-ready immigration assets across 27 categories",
      "The full Canadian RCIC marketing vault (PSD, AI, PDF, XLSX, DOCX)",
      "Lifetime updates — we ship new assets monthly",
      "4 free AI tools (CRS, NOC, EE Draw, SOP gen) — forever",
      "30-day refund — no form, no call, no exit interview",
    ],
    delivery: "Instant access",
    highlight: true,
    active: true,
  },
  {
    id: "firm",
    name: "THE FIRM",
    stripePriceId: env.STRIPE_PRICE_CUSTOM,
    price: 397,
    valuePrice: 6885,
    portalProMonths: 0,
    tagline: "Your brand. Our arsenal. Every asset carries your name.",
    valueAnchor: "normally $6,885",
    features: [
      "Everything in THE ESSENTIALS",
      "Your firm's logo + colors on every key asset",
      "50 social media designs custom-built for your practice",
      "Letterhead + business card + email signature",
      "Brand guide PDF (colors, fonts, voice)",
      "Delivered in 1-3 business days",
    ],
    delivery: "1-3 business days after intake form",
    highlight: false,
    active: true,
  },
  {
    id: "founder",
    name: "THE FOUNDER",
    stripePriceId: env.STRIPE_PRICE_ULTIMATE,
    price: 697,
    valuePrice: 25112,
    portalProMonths: 0,
    tagline: "The goldmine + the keys to the castle.",
    valueAnchor: "normally $25,112",
    topTierEntitlements: ["ai-tools", "crm", "dossiar"],
    features: [
      "Everything in THE FIRM",
      "Done-for-you website (5-7 days, mobile, SEO-optimized)",
      "The Million Dollar Vault — 12 bonus assets, Founder-only",
      "90 days FREE — AI Tools + CRM + DOSSIAR ($621 retail)",
      "1-on-1 onboarding call with founder (45 min)",
      "VIP Slack access (6 months, direct founder DM)",
      "Founder Lock-In: when prices rise, you keep yours forever",
    ],
    delivery: "Website delivered in 5-7 business days",
    highlight: false,
    active: true,
  },
];

// ─── Order-bump upsells (checkout-time add-ons) ─────────────────────────
// Shown as optional checkboxes on the Stripe checkout page. One-click add.
// Only TWO bumps chosen for focus — third feels like friction.
export interface OrderBump {
  id: string;
  name: string;
  description: string;
  price: number;
  /** Which tiers show this bump (hide if already included) */
  availableFor: string[];
  active: boolean;
}

export const ORDER_BUMPS: OrderBump[] = [
  {
    id: "custom-branding",
    name: "Add Custom Branding",
    description: "Apply your firm's logo + colors to all 305 assets. Delivered in 1-3 days.",
    price: 200,
    availableFor: ["toolkit"],
    active: true,
  },
  {
    id: "trial-3-products",
    name: "Add 90-Day Trial — AI Tools + CRM + DOSSIAR",
    description: "Full access to all three upcoming products for 90 days. Worth $621 retail.",
    price: 300,
    availableFor: ["toolkit", "firm"],
    active: true,
  },
];

const DEFAULT_PORTAL_PLANS: PortalPlan[] = [
  {
    id: "pro",
    name: "Pro",
    stripePriceId: env.STRIPE_PRICE_PORTAL_PRO,
    price: 19,
    interval: "month",
    features: [
      "All assets & downloads",
      "Unlimited AI generations",
      "Priority support",
    ],
    active: true,
  },
  {
    id: "business",
    name: "Business",
    stripePriceId: env.STRIPE_PRICE_PORTAL_BUSINESS,
    price: 49,
    interval: "month",
    features: [
      "Everything in Pro",
      "Custom branding tools",
      "Team management",
      "API access",
    ],
    active: true,
  },
];

// ─── Getters ────────────────────────────────────────────────

export async function getBundlePlans(): Promise<BundlePlan[]> {
  const setting = await SiteSetting.findOne({ key: "bundle_plans" });
  if (setting?.value && Array.isArray(setting.value) && setting.value.length > 0) {
    return setting.value as BundlePlan[];
  }
  return DEFAULT_BUNDLE_PLANS;
}

export async function getPortalPlans(): Promise<PortalPlan[]> {
  const setting = await SiteSetting.findOne({ key: "portal_plans" });
  if (setting?.value && Array.isArray(setting.value) && setting.value.length > 0) {
    return setting.value as PortalPlan[];
  }
  return DEFAULT_PORTAL_PLANS;
}

export async function getBundlePlanByTier(tier: string): Promise<BundlePlan | undefined> {
  const resolvedTier = resolveTierId(tier);
  const plans = await getBundlePlans();
  const found = plans.find((p) => p.id === resolvedTier && p.active);
  if (found) return found;
  // Fallback to defaults if DB plans are corrupted or missing this tier
  return DEFAULT_BUNDLE_PLANS.find((p) => p.id === resolvedTier && p.active);
}

export async function getPortalPlanById(planId: string): Promise<PortalPlan | undefined> {
  const plans = await getPortalPlans();
  return plans.find((p) => p.id === planId && p.active);
}
