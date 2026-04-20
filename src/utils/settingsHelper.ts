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
    id: "starter",
    name: "Starter Bundle",
    stripePriceId: env.STRIPE_PRICE_STARTER,
    price: 97,
    valuePrice: 4997,
    portalProMonths: 3,
    features: [
      "Full 227+ asset bundle (all 17 categories)",
      "1,000+ editable PSD files",
      "Instant delivery",
      "3 months FREE Portal Pro access",
      "Lifetime bundle updates",
    ],
    delivery: "Instant access",
    highlight: true,
    active: true,
  },
  {
    id: "custom",
    name: "Custom Branded",
    stripePriceId: env.STRIPE_PRICE_CUSTOM,
    price: 297,
    valuePrice: 9997,
    portalProMonths: 6,
    features: [
      "Everything in Starter",
      "Custom branding on all key templates",
      "Your logo, colors & firm name applied",
      "50 customized social media designs",
      "6 months FREE Portal Pro access",
      "Delivery in 1-3 business days",
    ],
    delivery: "1-3 business days after intake form",
    highlight: false,
    active: true,
  },
  {
    id: "ultimate",
    name: "Ultimate Launch Kit",
    stripePriceId: env.STRIPE_PRICE_ULTIMATE,
    price: 497,
    valuePrice: 14997,
    portalProMonths: 12,
    features: [
      "Everything in Custom Branded",
      "Done-for-you professional website",
      "Mobile-responsive & SEO-optimized site",
      "12 months FREE Portal Pro access",
      "1-on-1 onboarding call (30 min)",
      "VIP support for 6 months",
    ],
    delivery: "Website delivered in 5-7 business days",
    highlight: false,
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
  const plans = await getBundlePlans();
  const found = plans.find((p) => p.id === tier && p.active);
  if (found) return found;
  // Fallback to defaults if DB plans are corrupted or missing this tier
  return DEFAULT_BUNDLE_PLANS.find((p) => p.id === tier && p.active);
}

export async function getPortalPlanById(planId: string): Promise<PortalPlan | undefined> {
  const plans = await getPortalPlans();
  return plans.find((p) => p.id === planId && p.active);
}
