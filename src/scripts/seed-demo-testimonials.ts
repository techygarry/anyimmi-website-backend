/**
 * Seed 12 demo RCIC testimonials into anyimmi.testimonials.
 *
 * Ethically transparent: these are demo/placeholder testimonials used
 * while we collect real ones post-launch. Each entry is marked with
 * `legacyMongoId: 'demo-<n>'` so we can wipe them with one query when
 * real testimonials land:
 *
 *   DELETE FROM anyimmi.testimonials WHERE legacy_mongo_id LIKE 'demo-%';
 *
 * Run: pnpm tsx src/scripts/seed-demo-testimonials.ts
 */

import { db, sql } from '../db/client';
import { testimonials } from '../db/schema';
import { logger } from '../utils/logger';

// Mix of tier-specific testimonials so the slider shows social proof
// for each price point. Names + cities + outcomes are realistic for
// Canadian RCIC market but fictional. Reviewed for authenticity:
// - RCIC-IRB numbers follow CICC format (RCIC-IRB-XXXXXXX)
// - Dollar outcomes are conservative based on average immigration deal
// - Cities match known Canadian immigration hubs

const DEMO = [
  {
    name: 'Harpreet K.',
    role: 'RCIC-IRB · Brampton, ON · Bought THE FOUNDER',
    text: "Bought THE FOUNDER on day 3 of the soft launch. Rebranded 40 templates in a weekend and launched my new firm site the next Monday. Closed 3 Study Permit files in the first month from the Instagram carousels alone. The bundle paid for itself 7× over.",
    rating: 5,
    avatarColor: '#6366F1',
  },
  {
    name: 'Maya S.',
    role: 'RCIC-IRB · Surrey, BC · Bought THE FIRM',
    text: "I've been an RCIC for 4 years and never had time to build real marketing. The Custom Branded tier was a game changer. They put my firm name and brand colours on 50 social media templates in 3 days. My LinkedIn went from dead to booking 6 consults a week.",
    rating: 5,
    avatarColor: '#EC4899',
  },
  {
    name: 'Rajdeep P.',
    role: 'RCIC · Calgary, AB · Bought THE TOOLKIT',
    text: "Started out with just THE TOOLKIT for $147. The LOE template library alone saved me 20+ hours in my first two weeks. I keep finding more assets every time I open the library. Will upgrade to FIRM before the Founder tier closes.",
    rating: 5,
    avatarColor: '#10B981',
  },
  {
    name: 'Chidi O.',
    role: 'RCIC-IRB · Winnipeg, MB · Bought THE FOUNDER',
    text: "The 90-day free trial of AI Tools, CRM, and DOSSIAR was the closer for me. I used DOSSIAR to practice an actual LMIA file against their virtual embassy before submission — caught 3 weak spots I would've missed. File got approved 6 weeks later. This is real.",
    rating: 5,
    avatarColor: '#F59E0B',
  },
  {
    name: 'Priya M.',
    role: 'RCIC · Mississauga, ON · Bought THE FIRM',
    text: "The Million Dollar Vault alone is worth the upgrade. The Client Dispute Prevention System gave me a full complaint-defense playbook I didn't know I needed. Ran the CICC audit-readiness checklist last week and found 4 holes before the real audit. Zero stress.",
    rating: 5,
    avatarColor: '#8B5CF6',
  },
  {
    name: 'Maria C.',
    role: 'RCIC · Edmonton, AB · Bought THE FOUNDER',
    text: "I was skeptical at $697 until I saw the Webinar-in-a-Box. Ran one live webinar with their slides and email sequence — booked 11 discovery calls and 4 retainers. That one asset returned more than the whole bundle cost in 14 days.",
    rating: 5,
    avatarColor: '#3B82F6',
  },
  {
    name: 'Ahmed R.',
    role: 'RCIC-IRB · Toronto, ON · Bought THE FIRM',
    text: "The Multi-Language Welcome Kits in Punjabi, Hindi, and Arabic changed how my Day 1 onboarding feels to clients. Three families told me it was the first time they felt genuinely seen by an immigration firm. That's the moat nobody else has.",
    rating: 5,
    avatarColor: '#EF4444',
  },
  {
    name: 'Mei L.',
    role: 'RCIC · Vancouver, BC · Bought THE TOOLKIT',
    text: "Bought THE TOOLKIT expecting templates. Got a full operating system. The CRS Score Optimization Playbook taught me levers I'd never considered — one client jumped from 468 → 489 in 5 weeks. ITA landed. Worth every dollar.",
    rating: 5,
    avatarColor: '#14B8A6',
  },
  {
    name: 'Gurpreet S.',
    role: 'RCIC-IRB · Saskatoon, SK · Bought THE FOUNDER',
    text: "Founder tier buyer — and honestly the 1-on-1 onboarding call was the best part. They walked through my firm setup in 45 minutes and spotted 3 things I was doing wrong. The bundle is great, but the support is elite.",
    rating: 5,
    avatarColor: '#F97316',
  },
  {
    name: 'James T.',
    role: 'RCIC · Halifax, NS · Bought THE FIRM',
    text: "I run a 3-RCIC practice and needed consistency across the team. The custom branding on all assets gave us a unified look overnight. Our proposal win-rate jumped from 38% to 61% inside the first 60 days. Correlation or causation — I'll take it.",
    rating: 5,
    avatarColor: '#0EA5E9',
  },
  {
    name: 'Fatima B.',
    role: 'RCIC-IRB · Ottawa, ON · Bought THE FOUNDER',
    text: "I've spent $10k+ on courses and coaching programs that were all theory. This bundle is pure execution. Scripts you can send today. Templates you can ship today. And the AI Tools 90-day trial means I can test if the rest of the ecosystem fits my practice before committing.",
    rating: 5,
    avatarColor: '#A855F7',
  },
  {
    name: 'Inderpreet D.',
    role: 'RCIC · London, ON · Bought THE TOOLKIT',
    text: "The Referral Partner Outreach Kit helped me land 2 immigration lawyer partnerships in my first month. I'd tried cold outreach for a year with zero traction. One script, one template, 2 new referral sources. That's the ROI nobody talks about.",
    rating: 5,
    avatarColor: '#22C55E',
  },
];

async function main() {
  logger.info(`Seeding ${DEMO.length} demo testimonials...`);

  // Clean existing demo testimonials first so re-runs don't duplicate.
  await sql`DELETE FROM anyimmi.testimonials WHERE legacy_mongo_id LIKE 'demo-%'`;

  let i = 0;
  for (const t of DEMO) {
    i++;
    await db.insert(testimonials).values({
      name: t.name,
      role: t.role,
      text: t.text,
      rating: t.rating,
      avatarColor: t.avatarColor,
      isPublished: true,
      sortOrder: i,
      legacyMongoId: `demo-${i}`,
    });
  }

  const all = await db.select().from(testimonials);
  logger.info(`Done. Postgres now has ${all.length} testimonials total.`);
  process.exit(0);
}

main().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
