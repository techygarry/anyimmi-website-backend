import { z } from "zod";
import "dotenv/config";

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  PORT: z.coerce.number().default(5000),
  MONGODB_URI: z.string(),

  JWT_SECRET: z.string().min(16),
  JWT_REFRESH_SECRET: z.string().min(16),

  // Stripe — optional in dev (use placeholders)
  STRIPE_SECRET_KEY: z.string().default("sk_test_placeholder"),
  STRIPE_WEBHOOK_SECRET: z.string().default("whsec_placeholder"),
  STRIPE_PRICE_STARTER: z.string().default("price_starter_placeholder"),
  STRIPE_PRICE_CUSTOM: z.string().default("price_custom_placeholder"),
  STRIPE_PRICE_ULTIMATE: z.string().default("price_ultimate_placeholder"),
  STRIPE_PRICE_PORTAL_PRO: z.string().default("price_portal_pro_placeholder"),
  STRIPE_PRICE_PORTAL_BUSINESS: z.string().default("price_portal_business_placeholder"),

  // Gemini AI — optional in dev
  GEMINI_API_KEY: z.string().default("gemini_api_key_placeholder"),

  // S3-compatible storage (DO Spaces in prod, MinIO in dev)
  DO_SPACES_KEY: z.string(),
  DO_SPACES_SECRET: z.string(),
  DO_SPACES_BUCKET: z.string().default("anyimmi-assets"),
  DO_SPACES_REGION: z.string().default("us-east-1"),
  DO_SPACES_ENDPOINT: z.string().default("http://localhost:9000"),
  S3_FORCE_PATH_STYLE: z
    .string()
    .default("false")
    .transform((v) => v === "true"),

  // Email — optional in dev
  RESEND_API_KEY: z.string().default("re_placeholder"),
  RESEND_FROM_EMAIL: z.string().default("noreply@anyimmi.com"),

  // SMTP — used for local dev email testing (set USE_SMTP=true to enable)
  USE_SMTP: z.string().default("false").transform((v) => v === "true"),
  SMTP_HOST: z.string().default("localhost"),
  SMTP_PORT: z.coerce.number().default(587),
  SMTP_USER: z.string().default(""),
  SMTP_PASS: z.string().default(""),

  // Google OAuth — optional in dev
  GOOGLE_CLIENT_ID: z.string().default("google_client_id_placeholder"),
  GOOGLE_CLIENT_SECRET: z.string().default("google_client_secret_placeholder"),
  GOOGLE_CALLBACK_URL: z.string().default("http://localhost:5000/api/auth/google/callback"),

  // Firecrawl — optional
  FIRECRAWL_API_KEY: z.string().default("firecrawl_placeholder"),

  // WhatsApp Business API — optional
  WHATSAPP_API_URL: z.string().default("https://crmapi.whatsoreo.com/api/meta/v19.0"),
  WHATSAPP_PHONE_NUMBER_ID: z.string().default(""),
  WHATSAPP_ACCESS_TOKEN: z.string().default(""),

  FRONTEND_BUNDLE_URL: z.string().default("http://localhost:3000"),
  FRONTEND_PORTAL_URL: z.string().default("http://localhost:3001"),
  ADMIN_EMAIL: z.string().default("admin@anyimmi.com"),
});

export const env = envSchema.parse(process.env);
