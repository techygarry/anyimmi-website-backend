/**
 * One-time migration: MongoDB → Postgres (anyimmi schema).
 *
 * Idempotent: uses ON CONFLICT or upserts where applicable. Safe to re-run.
 *
 * Run: pnpm tsx src/scripts/migrate-mongo-to-postgres.ts
 */

import mongoose from 'mongoose';
import { db, sql } from '../db/client';
import {
  users,
  organizations,
  entitlements,
  founderCounter,
  bonusCountdown,
  bundleCategories,
  bundleSubcategories,
  bundleAssets,
  testimonials,
  sliderImages,
  contactSubmissions,
  leads,
  orders,
  siteSettings,
} from '../db/schema';
import { logger } from '../utils/logger';
import { env } from '../config/env';

// Lazy require Mongoose models so we don't break Postgres-only deployments.
async function getMongoModels() {
  await mongoose.connect(env.MONGODB_URI);
  return {
    User: mongoose.model('User', new mongoose.Schema({}, { strict: false }), 'users'),
    Entitlement: mongoose.model('Entitlement', new mongoose.Schema({}, { strict: false }), 'entitlements'),
    FounderCounter: mongoose.model('FounderCounter', new mongoose.Schema({}, { strict: false }), 'foundercounters'),
    BonusCountdown: mongoose.model('BonusCountdown', new mongoose.Schema({}, { strict: false }), 'bonuscountdowns'),
    Category: mongoose.model('Category', new mongoose.Schema({}, { strict: false }), 'categories'),
    Subcategory: mongoose.model('Subcategory', new mongoose.Schema({}, { strict: false }), 'subcategories'),
    Asset: mongoose.model('Asset', new mongoose.Schema({}, { strict: false }), 'assets'),
    Testimonial: mongoose.model('Testimonial', new mongoose.Schema({}, { strict: false }), 'testimonials'),
    SliderImage: mongoose.model('SliderImage', new mongoose.Schema({}, { strict: false }), 'sliderimages'),
    Contact: mongoose.model('Contact', new mongoose.Schema({}, { strict: false }), 'contacts'),
    Lead: mongoose.model('Lead', new mongoose.Schema({}, { strict: false }), 'leads'),
    Order: mongoose.model('Order', new mongoose.Schema({}, { strict: false }), 'orders'),
    SiteSetting: mongoose.model('SiteSetting', new mongoose.Schema({}, { strict: false }), 'sitesettings'),
  };
}

async function migrateUsers(M: Awaited<ReturnType<typeof getMongoModels>>) {
  const docs = await M.User.find({}).lean();
  logger.info(`Migrating ${docs.length} users...`);
  const idMap = new Map<string, string>(); // mongo _id → pg uuid
  for (const u of docs) {
    const mongoId = String(u._id);
    const [row] = await db
      .insert(users)
      .values({
        email: (u as any).email,
        name: (u as any).name ?? null,
        passwordHash: (u as any).password ?? null,
        role: (u as any).role === 'admin' ? 'admin' : 'owner',
        legacyMongoId: mongoId,
        portalProExpiresAt: (u as any).portalProExpiresAt ?? null,
        emailVerifiedAt: (u as any).emailVerifiedAt ?? null,
        createdAt: (u as any).createdAt ?? new Date(),
        updatedAt: (u as any).updatedAt ?? new Date(),
      })
      .onConflictDoUpdate({
        target: users.email,
        set: {
          legacyMongoId: mongoId,
          updatedAt: new Date(),
        },
      })
      .returning({ id: users.id });
    idMap.set(mongoId, row.id);
    // Also create solo org for each user.
    await db
      .insert(organizations)
      .values({
        type: 'solo',
        name: `${(u as any).name ?? (u as any).email.split('@')[0]}'s workspace`,
        ownerUserId: row.id,
      })
      .onConflictDoNothing();
  }
  return idMap;
}

async function migrateEntitlements(
  M: Awaited<ReturnType<typeof getMongoModels>>,
  userIdMap: Map<string, string>,
) {
  const docs = await M.Entitlement.find({}).lean();
  logger.info(`Migrating ${docs.length} entitlements...`);
  for (const e of docs) {
    const mongoUserId = String((e as any).userId);
    const pgUserId = userIdMap.get(mongoUserId);
    if (!pgUserId) {
      logger.warn(`Entitlement ${e._id} references missing user ${mongoUserId} — skipping`);
      continue;
    }
    await db
      .insert(entitlements)
      .values({
        userId: pgUserId,
        product: (e as any).product,
        tier: (e as any).tier,
        status: (e as any).status ?? 'active',
        source: (e as any).source ?? null,
        expiresAt: (e as any).expiresAt ?? null,
        externalRef: (e as any).externalRef ?? null,
        metadata: (e as any).metadata ?? null,
        createdAt: (e as any).createdAt ?? new Date(),
        updatedAt: (e as any).updatedAt ?? new Date(),
      })
      .onConflictDoUpdate({
        target: [entitlements.userId, entitlements.product],
        set: {
          tier: (e as any).tier,
          status: (e as any).status ?? 'active',
          expiresAt: (e as any).expiresAt ?? null,
          updatedAt: new Date(),
        },
      });
  }
}

async function migrateFounderCounter(M: Awaited<ReturnType<typeof getMongoModels>>) {
  const doc = await M.FounderCounter.findOne({}).lean();
  if (!doc) return logger.info('No founder counter doc — skipping');
  await db
    .insert(founderCounter)
    .values({
      id: 1,
      current: (doc as any).current ?? 287,
      target: (doc as any).target ?? 500,
      active: (doc as any).active ?? true,
    })
    .onConflictDoUpdate({
      target: founderCounter.id,
      set: {
        current: (doc as any).current ?? 287,
        target: (doc as any).target ?? 500,
        active: (doc as any).active ?? true,
        updatedAt: new Date(),
      },
    });
  logger.info('Founder counter migrated.');
}

async function migrateBonusCountdown(M: Awaited<ReturnType<typeof getMongoModels>>) {
  const doc = await M.BonusCountdown.findOne({}).lean();
  if (!doc) return logger.info('No bonus countdown doc — skipping');
  await db
    .insert(bonusCountdown)
    .values({
      id: 1,
      expiresAt: (doc as any).expiresAt,
      bonusDescription: (doc as any).bonusDescription,
      active: (doc as any).active ?? true,
    })
    .onConflictDoUpdate({
      target: bonusCountdown.id,
      set: {
        expiresAt: (doc as any).expiresAt,
        bonusDescription: (doc as any).bonusDescription,
        active: (doc as any).active ?? true,
        updatedAt: new Date(),
      },
    });
  logger.info('Bonus countdown migrated.');
}

async function migrateContent(M: Awaited<ReturnType<typeof getMongoModels>>) {
  const ts = await M.Testimonial.find({}).lean();
  if (ts.length) {
    for (const t of ts) {
      await db
        .insert(testimonials)
        .values({
          name: (t as any).name,
          role: (t as any).role ?? null,
          text: (t as any).text,
          rating: (t as any).rating ?? 5,
          avatarColor: (t as any).avatarColor ?? null,
          isPublished: (t as any).isPublished ?? true,
          sortOrder: (t as any).sortOrder ?? 0,
          legacyMongoId: String(t._id),
        })
        .onConflictDoNothing();
    }
    logger.info(`Migrated ${ts.length} testimonials`);
  }

  const sis = await M.SliderImage.find({}).lean();
  if (sis.length) {
    for (const s of sis) {
      await db
        .insert(sliderImages)
        .values({
          title: (s as any).title ?? null,
          imageUrl: (s as any).imageUrl,
          sortOrder: (s as any).sortOrder ?? 0,
          isPublished: (s as any).isPublished ?? true,
          legacyMongoId: String(s._id),
        })
        .onConflictDoNothing();
    }
    logger.info(`Migrated ${sis.length} slider images`);
  }

  const cs = await M.Contact.find({}).lean();
  if (cs.length) {
    for (const c of cs) {
      await db.insert(contactSubmissions).values({
        name: (c as any).name,
        email: (c as any).email,
        phone: (c as any).phone ?? null,
        message: (c as any).message,
        source: (c as any).source ?? null,
        createdAt: (c as any).createdAt ?? new Date(),
      });
    }
    logger.info(`Migrated ${cs.length} contact submissions`);
  }

  const ls = await M.Lead.find({}).lean();
  if (ls.length) {
    for (const l of ls) {
      await db.insert(leads).values({
        email: (l as any).email,
        name: (l as any).name ?? null,
        source: (l as any).source ?? null,
        metadata: (l as any).metadata ?? null,
        createdAt: (l as any).createdAt ?? new Date(),
      });
    }
    logger.info(`Migrated ${ls.length} leads`);
  }
}

async function migrateBundle(M: Awaited<ReturnType<typeof getMongoModels>>) {
  const cats = await M.Category.find({}).lean();
  const catIdMap = new Map<string, string>();
  for (const c of cats) {
    const [row] = await db
      .insert(bundleCategories)
      .values({
        slug: (c as any).slug,
        name: (c as any).name,
        description: (c as any).description ?? null,
        longDescription: (c as any).longDescription ?? null,
        icon: (c as any).icon ?? null,
        image: (c as any).image ?? null,
        fileCount: (c as any).fileCount ?? null,
        features: (c as any).features ?? [],
        previewImages: (c as any).previewImages ?? [],
        useCases: (c as any).useCases ?? [],
        sortOrder: (c as any).sortOrder ?? 0,
        isLocked: (c as any).isLocked ?? false,
        unlockTier: (c as any).unlockTier ?? null,
        legacyMongoId: String(c._id),
      })
      .onConflictDoUpdate({
        target: bundleCategories.slug,
        set: { updatedAt: new Date() },
      })
      .returning({ id: bundleCategories.id });
    catIdMap.set(String(c._id), row.id);
  }
  if (cats.length) logger.info(`Migrated ${cats.length} categories`);

  const subs = await M.Subcategory.find({}).lean();
  for (const s of subs) {
    const catId = catIdMap.get(String((s as any).categoryId));
    if (!catId) continue;
    await db
      .insert(bundleSubcategories)
      .values({
        categoryId: catId,
        slug: (s as any).slug,
        name: (s as any).name,
        description: (s as any).description ?? null,
        format: (s as any).format ?? null,
        previewImages: (s as any).previewImages ?? [],
        sortOrder: (s as any).sortOrder ?? 0,
        legacyMongoId: String(s._id),
      })
      .onConflictDoNothing();
  }
  if (subs.length) logger.info(`Migrated ${subs.length} subcategories`);

  const assets = await M.Asset.find({}).lean();
  for (const a of assets) {
    const catId = catIdMap.get(String((a as any).category));
    if (!catId) continue;
    await db
      .insert(bundleAssets)
      .values({
        categoryId: catId,
        slug: (a as any).slug ?? String(a._id),
        name: (a as any).name,
        description: (a as any).description ?? null,
        fileFormat: (a as any).fileFormat ?? null,
        filePath: (a as any).filePath ?? null,
        fileSizeBytes: (a as any).fileSizeBytes ?? null,
        previewUrl: (a as any).previewUrl ?? null,
        previewThumbnailUrl: (a as any).previewThumbnailUrl ?? null,
        previewPages: (a as any).previewPages ?? [],
        pageCount: (a as any).pageCount ?? null,
        tags: (a as any).tags ?? [],
        downloadCount: (a as any).downloadCount ?? 0,
        valueTier: (a as any).valueTier ?? null,
        isPublished: (a as any).isPublished ?? false,
        version: (a as any).version ?? 1,
        legacyMongoId: String(a._id),
      })
      .onConflictDoNothing();
  }
  if (assets.length) logger.info(`Migrated ${assets.length} assets`);
}

async function migrateOrders(
  M: Awaited<ReturnType<typeof getMongoModels>>,
  userIdMap: Map<string, string>,
) {
  const docs = await M.Order.find({}).lean();
  for (const o of docs) {
    const mongoUserId = (o as any).userId ? String((o as any).userId) : null;
    const pgUserId = mongoUserId ? userIdMap.get(mongoUserId) : null;
    await db
      .insert(orders)
      .values({
        userId: pgUserId ?? null,
        email: (o as any).email,
        tier: (o as any).tier,
        amountCents: (o as any).amountCents ?? Math.round(((o as any).amount ?? 0) * 100),
        currency: (o as any).currency ?? 'usd',
        status: (o as any).status ?? 'pending',
        stripeCheckoutSessionId: (o as any).stripeCheckoutSessionId ?? null,
        stripePaymentIntentId: (o as any).stripePaymentIntentId ?? null,
        invoiceNumber: (o as any).invoiceNumber ?? null,
        metadata: (o as any).metadata ?? null,
        paidAt: (o as any).paidAt ?? null,
        createdAt: (o as any).createdAt ?? new Date(),
        updatedAt: (o as any).updatedAt ?? new Date(),
      })
      .onConflictDoNothing();
  }
  if (docs.length) logger.info(`Migrated ${docs.length} orders`);
}

async function migrateSettings(M: Awaited<ReturnType<typeof getMongoModels>>) {
  const docs = await M.SiteSetting.find({}).lean();
  for (const s of docs) {
    await db
      .insert(siteSettings)
      .values({
        key: (s as any).key,
        value: (s as any).value,
      })
      .onConflictDoUpdate({
        target: siteSettings.key,
        set: { value: (s as any).value, updatedAt: new Date() },
      });
  }
  if (docs.length) logger.info(`Migrated ${docs.length} site settings`);
}

async function main() {
  logger.info('Starting Mongo → Postgres migration...');
  const M = await getMongoModels();
  try {
    const userIdMap = await migrateUsers(M);
    await migrateEntitlements(M, userIdMap);
    await migrateFounderCounter(M);
    await migrateBonusCountdown(M);
    await migrateContent(M);
    await migrateBundle(M);
    await migrateOrders(M, userIdMap);
    await migrateSettings(M);

    // Final tallies
    const [{ count: pgUsers }] = (await sql`SELECT count(*) FROM anyimmi.users`) as any;
    const [{ count: pgEnt }] = (await sql`SELECT count(*) FROM anyimmi.entitlements`) as any;
    const [{ count: pgOrgs }] = (await sql`SELECT count(*) FROM anyimmi.organizations`) as any;
    logger.info(`Postgres counts → users:${pgUsers} entitlements:${pgEnt} orgs:${pgOrgs}`);
    logger.info('Migration complete.');
  } finally {
    await mongoose.disconnect();
    await sql.end();
  }
}

main().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});
