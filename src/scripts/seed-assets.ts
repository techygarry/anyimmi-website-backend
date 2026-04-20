import "dotenv/config";
import mongoose from "mongoose";
import { env } from "../config/env.js";
import { Category } from "../modules/assets/category.model.js";
import { Asset } from "../modules/assets/asset.model.js";

/**
 * Seed assets — one zip bundle per category (18 total).
 * Each asset is a single Google Drive zip download for the entire category.
 *
 * Usage:  npx tsx src/scripts/seed-assets.ts
 *
 * Replace PLACEHOLDER_* Drive URLs with your real shared links before running.
 */

const assets = [
  {
    name: "Foundation Assets Bundle",
    description: "High-impact business launch essentials — agreements, compliance, pricing, CRM, and roadmaps.",
    categorySlug: "foundation-assets",
    tags: ["agreement", "compliance", "crm", "pricing", "roadmap"],
    programType: ["general"],
    driveUrl: "https://drive.google.com/file/d/PLACEHOLDER_FOUNDATION/view?usp=sharing",
    isFree: true,
  },
  {
    name: "Professional Checklists Bundle",
    description: "Step-by-step document checklists for Express Entry, Study Permits, Spousal, Visitor & more.",
    categorySlug: "professional-checklists",
    tags: ["checklist", "express-entry", "study-permit", "spousal", "visitor"],
    programType: ["express-entry", "study-permit", "spousal", "visitor"],
    driveUrl: "https://drive.google.com/file/d/PLACEHOLDER_CHECKLISTS/view?usp=sharing",
    isFree: true,
  },
  {
    name: "Immigration Guides Bundle",
    description: "Newcomer handbooks, settlement guides, SOP writing, IELTS prep, and PR program explainers.",
    categorySlug: "immigration-guides",
    tags: ["guide", "settlement", "sop", "ielts", "pr"],
    programType: ["general"],
    driveUrl: "https://drive.google.com/file/d/PLACEHOLDER_GUIDES/view?usp=sharing",
  },
  {
    name: "Branding Assets Bundle",
    description: "Letterheads, business cards, invoices, signage, email signatures, and branded templates.",
    categorySlug: "branding-assets",
    tags: ["letterhead", "business-card", "invoice", "branding"],
    programType: ["general"],
    driveUrl: "https://drive.google.com/file/d/PLACEHOLDER_BRANDING/view?usp=sharing",
  },
  {
    name: "Social Media Content Bundle",
    description: "Ready-to-post captions, carousels, stories, testimonials, and engagement templates.",
    categorySlug: "social-media-content",
    tags: ["social-media", "caption", "carousel", "story"],
    programType: ["general"],
    driveUrl: "https://drive.google.com/file/d/PLACEHOLDER_SOCIAL/view?usp=sharing",
    isFree: true,
  },
  {
    name: "Content Calendar & AI Bundle",
    description: "52-week content calendar, AI prompt libraries, and landing page generation tools.",
    categorySlug: "content-calendar-ai",
    tags: ["calendar", "ai", "prompt", "landing-page"],
    programType: ["general"],
    driveUrl: "https://drive.google.com/file/d/PLACEHOLDER_CALENDAR/view?usp=sharing",
  },
  {
    name: "Admin & Client Prep Bundle",
    description: "Intake forms, questionnaires, IRCC guides, biometrics prep, and visa rejection planners.",
    categorySlug: "admin-client-prep",
    tags: ["intake", "questionnaire", "ircc", "biometrics"],
    programType: ["general"],
    driveUrl: "https://drive.google.com/file/d/PLACEHOLDER_ADMIN/view?usp=sharing",
  },
  {
    name: "Email Templates Bundle",
    description: "Consultation confirmations, follow-ups, newsletters, referral requests, and nurture sequences.",
    categorySlug: "email-templates",
    tags: ["email", "follow-up", "newsletter", "nurture"],
    programType: ["general"],
    driveUrl: "https://drive.google.com/file/d/PLACEHOLDER_EMAIL/view?usp=sharing",
  },
  {
    name: "Presentations & Video Bundle",
    description: "Webinar slide decks, firm presentations, video scripts, and process one-pagers.",
    categorySlug: "presentations-video",
    tags: ["presentation", "webinar", "video", "slides"],
    programType: ["general"],
    driveUrl: "https://drive.google.com/file/d/PLACEHOLDER_PRESENTATIONS/view?usp=sharing",
  },
  {
    name: "Marketing Engine Bundle",
    description: "Reels scripts, caption banks, ad libraries, lead magnets, SEO kits, and landing page copy.",
    categorySlug: "marketing-engine",
    tags: ["marketing", "reels", "ads", "seo", "lead-magnet"],
    programType: ["general"],
    driveUrl: "https://drive.google.com/file/d/PLACEHOLDER_MARKETING/view?usp=sharing",
  },
  {
    name: "Trust Builders Bundle",
    description: "Trust badges, office print kits, client education decks, FAQ libraries, and testimonial systems.",
    categorySlug: "trust-builders",
    tags: ["trust", "badge", "faq", "testimonial"],
    programType: ["general"],
    driveUrl: "https://drive.google.com/file/d/PLACEHOLDER_TRUST/view?usp=sharing",
  },
  {
    name: "Unique Bonuses Bundle",
    description: "Canva brand kits, icon packs, shot lists, gift inserts, webinar kits, and quick-start content.",
    categorySlug: "unique-bonuses",
    tags: ["canva", "icons", "webinar", "gift", "bonus"],
    programType: ["general"],
    driveUrl: "https://drive.google.com/file/d/PLACEHOLDER_BONUSES/view?usp=sharing",
  },
  {
    name: "Lead Conversion & Sales Bundle",
    description: "CTAs, objection crushers, pricing sheets, booking scripts, lead scoring, and referral templates.",
    categorySlug: "module-a-lead-conversion",
    tags: ["sales", "cta", "pricing", "lead-scoring", "referral"],
    programType: ["general"],
    driveUrl: "https://drive.google.com/file/d/PLACEHOLDER_MOD_A/view?usp=sharing",
  },
  {
    name: "Client Experience & Trust Bundle",
    description: "Onboarding, status updates, consent forms, feedback surveys, and client journey roadmaps.",
    categorySlug: "module-b-client-experience",
    tags: ["onboarding", "consent", "feedback", "journey"],
    programType: ["general"],
    driveUrl: "https://drive.google.com/file/d/PLACEHOLDER_MOD_B/view?usp=sharing",
  },
  {
    name: "Marketing Content Packs Bundle",
    description: "Reels hooks, carousel banks, brand voice guides, myth-busters, and community outreach packs.",
    categorySlug: "module-c-marketing-content",
    tags: ["reels", "carousel", "brand-voice", "community"],
    programType: ["general"],
    driveUrl: "https://drive.google.com/file/d/PLACEHOLDER_MOD_C/view?usp=sharing",
  },
  {
    name: "Ads, Funnels & Growth Bundle",
    description: "Meta & Google ads, retargeting copy, lead funnels, UGC scripts, and KPI dashboards.",
    categorySlug: "module-d-ads-funnels",
    tags: ["ads", "funnel", "retargeting", "kpi", "ugc"],
    programType: ["general"],
    driveUrl: "https://drive.google.com/file/d/PLACEHOLDER_MOD_D/view?usp=sharing",
  },
  {
    name: "Ops, SOPs & Quality Control Bundle",
    description: "File review checklists, naming standards, escalation SOPs, reporting templates, and audit tools.",
    categorySlug: "module-e-ops-sops",
    tags: ["sop", "audit", "compliance", "reporting"],
    programType: ["general"],
    driveUrl: "https://drive.google.com/file/d/PLACEHOLDER_MOD_E/view?usp=sharing",
  },
  {
    name: "Expansion Assets Bundle",
    description: "IMM form guides, LOE templates, CRS playbooks, LMIA toolkits, and multi-language welcome kits.",
    categorySlug: "expansion-assets",
    tags: ["imm", "loe", "crs", "lmia", "multilingual"],
    programType: ["express-entry", "work-permit", "general"],
    driveUrl: "https://drive.google.com/file/d/PLACEHOLDER_EXPANSION/view?usp=sharing",
  },
];

async function seedAssets() {
  console.log("Connecting to MongoDB...");
  await mongoose.connect(env.MONGODB_URI);
  console.log("Connected.\n");

  const categories = await Category.find();
  const catMap: Record<string, mongoose.Types.ObjectId> = {};
  for (const cat of categories) {
    catMap[cat.slug] = cat._id;
  }
  console.log(`Found ${categories.length} categories.\n`);

  let created = 0;
  let skipped = 0;

  for (const asset of assets) {
    const categoryId = catMap[asset.categorySlug];
    if (!categoryId) {
      console.warn(`  SKIP: Category "${asset.categorySlug}" not found`);
      skipped++;
      continue;
    }

    const existing = await Asset.findOne({ name: asset.name });
    if (existing) {
      console.log(`  EXISTS: ${asset.name}`);
      skipped++;
      continue;
    }

    await Asset.create({
      name: asset.name,
      description: asset.description,
      category: categoryId,
      tags: asset.tags,
      fileFormat: "zip",
      fileUrl: "",
      driveUrl: asset.driveUrl,
      sourceType: "drive",
      isFree: asset.isFree ?? false,
      programType: asset.programType,
    });

    console.log(`  CREATED: ${asset.name}`);
    created++;
  }

  // Update category asset counts
  for (const [slug, catId] of Object.entries(catMap)) {
    const count = await Asset.countDocuments({ category: catId });
    await Category.findByIdAndUpdate(catId, { assetCount: count });
  }

  console.log(`\nDone! Created: ${created}, Skipped: ${skipped}`);
  console.log(`Total assets in DB: ${await Asset.countDocuments()}`);

  await mongoose.disconnect();
  process.exit(0);
}

seedAssets().catch((err) => {
  console.error("Seed assets failed:", err);
  process.exit(1);
});
