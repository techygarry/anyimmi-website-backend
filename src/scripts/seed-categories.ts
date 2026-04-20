import "dotenv/config";
import mongoose from "mongoose";
import { env } from "../config/env.js";
import { Category } from "../modules/assets/category.model.js";

const categories = [
  {
    name: "Foundation Assets",
    slug: "foundation-assets",
    description: "High-impact business launch essentials — agreements, compliance, pricing, CRM, and roadmaps.",
    icon: "Landmark",
    sortOrder: 1,
  },
  {
    name: "Professional Checklists",
    slug: "professional-checklists",
    description: "Step-by-step document checklists for Express Entry, Study Permits, Spousal, Visitor & more.",
    icon: "ClipboardCheck",
    sortOrder: 2,
  },
  {
    name: "Immigration Guides",
    slug: "immigration-guides",
    description: "Newcomer handbooks, settlement guides, SOP writing, IELTS prep, and PR program explainers.",
    icon: "BookOpen",
    sortOrder: 3,
  },
  {
    name: "Branding Assets",
    slug: "branding-assets",
    description: "Letterheads, business cards, invoices, signage, email signatures, and branded templates.",
    icon: "Palette",
    sortOrder: 4,
  },
  {
    name: "Social Media Content",
    slug: "social-media-content",
    description: "Ready-to-post captions, carousels, stories, testimonials, and engagement templates.",
    icon: "Share2",
    sortOrder: 5,
  },
  {
    name: "Content Calendar & AI",
    slug: "content-calendar-ai",
    description: "52-week content calendar, AI prompt libraries, and landing page generation tools.",
    icon: "Calendar",
    sortOrder: 6,
  },
  {
    name: "Admin & Client Prep",
    slug: "admin-client-prep",
    description: "Intake forms, questionnaires, IRCC guides, biometrics prep, and visa rejection planners.",
    icon: "Settings",
    sortOrder: 7,
  },
  {
    name: "Email Templates",
    slug: "email-templates",
    description: "Consultation confirmations, follow-ups, newsletters, referral requests, and nurture sequences.",
    icon: "Mail",
    sortOrder: 8,
  },
  {
    name: "Presentations & Video",
    slug: "presentations-video",
    description: "Webinar slide decks, firm presentations, video scripts, and process one-pagers.",
    icon: "Monitor",
    sortOrder: 9,
  },
  {
    name: "Marketing Engine",
    slug: "marketing-engine",
    description: "Reels scripts, caption banks, ad libraries, lead magnets, SEO kits, and landing page copy.",
    icon: "Rocket",
    sortOrder: 10,
  },
  {
    name: "Trust Builders",
    slug: "trust-builders",
    description: "Trust badges, office print kits, client education decks, FAQ libraries, and testimonial systems.",
    icon: "Shield",
    sortOrder: 11,
  },
  {
    name: "Unique Bonuses",
    slug: "unique-bonuses",
    description: "Canva brand kits, icon packs, shot lists, gift inserts, webinar kits, and quick-start content.",
    icon: "Gift",
    sortOrder: 12,
  },
  {
    name: "Module A: Lead Conversion & Sales",
    slug: "module-a-lead-conversion",
    description: "CTAs, objection crushers, pricing sheets, booking scripts, lead scoring, and referral templates.",
    icon: "TrendingUp",
    sortOrder: 13,
  },
  {
    name: "Module B: Client Experience & Trust",
    slug: "module-b-client-experience",
    description: "Onboarding, status updates, consent forms, feedback surveys, and client journey roadmaps.",
    icon: "Heart",
    sortOrder: 14,
  },
  {
    name: "Module C: Marketing Content Packs",
    slug: "module-c-marketing-content",
    description: "Reels hooks, carousel banks, brand voice guides, myth-busters, and community outreach packs.",
    icon: "Megaphone",
    sortOrder: 15,
  },
  {
    name: "Module D: Ads, Funnels & Growth",
    slug: "module-d-ads-funnels",
    description: "Meta & Google ads, retargeting copy, lead funnels, UGC scripts, and KPI dashboards.",
    icon: "Target",
    sortOrder: 16,
  },
  {
    name: "Module E: Ops, SOPs & Quality Control",
    slug: "module-e-ops-sops",
    description: "File review checklists, naming standards, escalation SOPs, reporting templates, and audit tools.",
    icon: "Cog",
    sortOrder: 17,
  },
  {
    name: "Expansion Assets",
    slug: "expansion-assets",
    description: "IMM form guides, LOE templates, CRS playbooks, LMIA toolkits, and multi-language welcome kits.",
    icon: "Sparkles",
    sortOrder: 18,
  },
];

async function seedCategories() {
  console.log("Connecting to MongoDB...");
  await mongoose.connect(env.MONGODB_URI);
  console.log("Connected.\n");

  // Delete all existing categories
  const deleted = await Category.deleteMany({});
  console.log(`Deleted ${deleted.deletedCount} existing categories.\n`);

  // Insert fresh categories
  for (const cat of categories) {
    await Category.create(cat);
    console.log(`  Created: ${cat.name} (${cat.icon})`);
  }

  console.log(`\nDone! ${categories.length} categories seeded.`);

  await mongoose.disconnect();
  process.exit(0);
}

seedCategories().catch((err) => {
  console.error("Seed categories failed:", err);
  process.exit(1);
});
