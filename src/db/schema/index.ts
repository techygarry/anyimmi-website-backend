/**
 * AnyImmi Postgres schema (Drizzle).
 *
 * Lives in the `anyimmi` Postgres schema for clean separation from
 * dossiar's `public.*` tables (when sharing the same Supabase instance).
 *
 * Mirrors the previous Mongoose models in src/modules/* but normalized
 * for relational + RLS-ready usage.
 */

import {
  pgSchema,
  text,
  uuid,
  varchar,
  integer,
  bigint,
  boolean,
  timestamp,
  jsonb,
  index,
  uniqueIndex,
  pgEnum,
} from 'drizzle-orm/pg-core';

// ─── Schema namespace ─────────────────────────────────────────────────────
export const anyimmi = pgSchema('anyimmi');

// ─── Enums ────────────────────────────────────────────────────────────────
export const orgTypeEnum = anyimmi.enum('org_type', ['solo', 'firm']);
export const userRoleEnum = anyimmi.enum('user_role', [
  'owner',
  'admin',
  'member',
  'viewer',
  'billing_only',
  'super_admin',
]);
export const productEnum = anyimmi.enum('product', [
  'bundle',
  'ai-tools',
  'crm',
  'dossiar',
  'portal-pro',
]);
export const entitlementStatusEnum = anyimmi.enum('entitlement_status', [
  'active',
  'past_due',
  'canceled',
  'trialing',
]);
export const entitlementSourceEnum = anyimmi.enum('entitlement_source', [
  'subscription',
  'bundle-founder',
  'trial',
  'manual',
]);
export const orderStatusEnum = anyimmi.enum('order_status', [
  'pending',
  'paid',
  'refunded',
  'failed',
]);

// ─── Identity ─────────────────────────────────────────────────────────────

export const users = anyimmi.table(
  'users',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    email: text('email').notNull(),
    name: text('name'),
    /** Bcrypt hash. Null for OAuth-only or magic-link-only users. */
    passwordHash: text('password_hash'),
    role: userRoleEnum('role').default('owner').notNull(),
    /** Legacy Mongo _id, kept for migration backref. */
    legacyMongoId: varchar('legacy_mongo_id', { length: 24 }),
    portalProExpiresAt: timestamp('portal_pro_expires_at', { withTimezone: true }),
    emailVerifiedAt: timestamp('email_verified_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    emailUx: uniqueIndex('users_email_ux').on(t.email),
    legacyMongoIx: index('users_legacy_mongo_ix').on(t.legacyMongoId),
  }),
);

export const organizations = anyimmi.table('organizations', {
  id: uuid('id').defaultRandom().primaryKey(),
  type: orgTypeEnum('type').default('solo').notNull(),
  name: text('name').notNull(),
  ownerUserId: uuid('owner_user_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

export const orgMembers = anyimmi.table(
  'org_members',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    orgId: uuid('org_id').references(() => organizations.id, { onDelete: 'cascade' }).notNull(),
    userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
    role: userRoleEnum('role').default('member').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    orgUserUx: uniqueIndex('org_members_org_user_ux').on(t.orgId, t.userId),
  }),
);

// ─── Entitlements (the truth of who owns what) ────────────────────────────

export const entitlements = anyimmi.table(
  'entitlements',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    /** Org-scoped in v2. For now, user-scoped (matches Mongo current state). */
    userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
    orgId: uuid('org_id').references(() => organizations.id, { onDelete: 'cascade' }),
    product: productEnum('product').notNull(),
    tier: text('tier').notNull(),
    status: entitlementStatusEnum('status').default('active').notNull(),
    source: entitlementSourceEnum('source'),
    expiresAt: timestamp('expires_at', { withTimezone: true }),
    /** Stripe subscription / order id for traceability */
    externalRef: text('external_ref'),
    metadata: jsonb('metadata'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    userProductUx: uniqueIndex('entitlements_user_product_ux').on(t.userId, t.product),
    statusIx: index('entitlements_status_ix').on(t.status),
    expiresIx: index('entitlements_expires_ix').on(t.expiresAt),
  }),
);

// ─── Orders (Stripe checkout history) ─────────────────────────────────────

export const orders = anyimmi.table(
  'orders',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: uuid('user_id').references(() => users.id, { onDelete: 'set null' }),
    email: text('email').notNull(),
    tier: text('tier').notNull(),
    amountCents: integer('amount_cents').notNull(),
    currency: varchar('currency', { length: 8 }).default('usd').notNull(),
    status: orderStatusEnum('status').default('pending').notNull(),
    stripeCheckoutSessionId: text('stripe_checkout_session_id'),
    stripePaymentIntentId: text('stripe_payment_intent_id'),
    invoiceNumber: text('invoice_number'),
    metadata: jsonb('metadata'),
    paidAt: timestamp('paid_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    sessionUx: uniqueIndex('orders_session_ux').on(t.stripeCheckoutSessionId),
    emailIx: index('orders_email_ix').on(t.email),
  }),
);

// ─── Bundle content ───────────────────────────────────────────────────────

export const bundleCategories = anyimmi.table(
  'bundle_categories',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    slug: text('slug').notNull(),
    name: text('name').notNull(),
    description: text('description'),
    longDescription: text('long_description'),
    icon: text('icon'),
    image: text('image'),
    fileCount: text('file_count'),
    features: jsonb('features').$type<string[]>().default([]),
    previewImages: jsonb('preview_images').$type<string[]>().default([]),
    useCases: jsonb('use_cases').$type<string[]>().default([]),
    sortOrder: integer('sort_order').default(0).notNull(),
    isLocked: boolean('is_locked').default(false).notNull(),
    unlockTier: text('unlock_tier'),
    legacyMongoId: varchar('legacy_mongo_id', { length: 24 }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    slugUx: uniqueIndex('bundle_categories_slug_ux').on(t.slug),
    legacyIx: index('bundle_categories_legacy_ix').on(t.legacyMongoId),
  }),
);

export const bundleSubcategories = anyimmi.table(
  'bundle_subcategories',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    categoryId: uuid('category_id').references(() => bundleCategories.id, { onDelete: 'cascade' }).notNull(),
    slug: text('slug').notNull(),
    name: text('name').notNull(),
    description: text('description'),
    format: text('format'),
    previewImages: jsonb('preview_images').$type<string[]>().default([]),
    sortOrder: integer('sort_order').default(0).notNull(),
    legacyMongoId: varchar('legacy_mongo_id', { length: 24 }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    catSlugUx: uniqueIndex('bundle_subcategories_cat_slug_ux').on(t.categoryId, t.slug),
  }),
);

export const bundleAssets = anyimmi.table(
  'bundle_assets',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    categoryId: uuid('category_id').references(() => bundleCategories.id, { onDelete: 'cascade' }).notNull(),
    subcategoryId: uuid('subcategory_id').references(() => bundleSubcategories.id, { onDelete: 'set null' }),
    slug: text('slug').notNull(),
    name: text('name').notNull(),
    description: text('description'),
    fileFormat: text('file_format'),
    filePath: text('file_path'),
    fileSizeBytes: bigint('file_size_bytes', { mode: 'number' }),
    previewUrl: text('preview_url'),
    previewThumbnailUrl: text('preview_thumbnail_url'),
    previewPages: jsonb('preview_pages').$type<string[]>().default([]),
    pageCount: integer('page_count'),
    tags: jsonb('tags').$type<string[]>().default([]),
    downloadCount: integer('download_count').default(0).notNull(),
    favoriteCount: integer('favorite_count').default(0).notNull(),
    valueTier: text('value_tier'),
    isPublished: boolean('is_published').default(false).notNull(),
    version: integer('version').default(1).notNull(),
    legacyMongoId: varchar('legacy_mongo_id', { length: 24 }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    catSlugUx: uniqueIndex('bundle_assets_cat_slug_ux').on(t.categoryId, t.slug),
    publishedIx: index('bundle_assets_published_ix').on(t.isPublished),
  }),
);

export const bundleDownloads = anyimmi.table(
  'bundle_downloads',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: uuid('user_id').references(() => users.id, { onDelete: 'set null' }),
    assetId: uuid('asset_id').references(() => bundleAssets.id, { onDelete: 'cascade' }).notNull(),
    orgId: uuid('org_id').references(() => organizations.id, { onDelete: 'set null' }),
    ip: text('ip'),
    userAgent: text('user_agent'),
    downloadedAt: timestamp('downloaded_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    userIx: index('bundle_downloads_user_ix').on(t.userId),
    assetIx: index('bundle_downloads_asset_ix').on(t.assetId),
  }),
);

// ─── Marketing content (testimonials, slider, contact, etc.) ──────────────

export const testimonials = anyimmi.table('testimonials', {
  id: uuid('id').defaultRandom().primaryKey(),
  name: text('name').notNull(),
  role: text('role'),
  text: text('text').notNull(),
  rating: integer('rating').default(5).notNull(),
  avatarColor: text('avatar_color'),
  isPublished: boolean('is_published').default(true).notNull(),
  sortOrder: integer('sort_order').default(0).notNull(),
  legacyMongoId: varchar('legacy_mongo_id', { length: 24 }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

export const sliderImages = anyimmi.table('slider_images', {
  id: uuid('id').defaultRandom().primaryKey(),
  title: text('title'),
  imageUrl: text('image_url').notNull(),
  sortOrder: integer('sort_order').default(0).notNull(),
  isPublished: boolean('is_published').default(true).notNull(),
  legacyMongoId: varchar('legacy_mongo_id', { length: 24 }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

export const contactSubmissions = anyimmi.table('contact_submissions', {
  id: uuid('id').defaultRandom().primaryKey(),
  name: text('name').notNull(),
  email: text('email').notNull(),
  phone: text('phone'),
  message: text('message').notNull(),
  source: text('source'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

export const leads = anyimmi.table('leads', {
  id: uuid('id').defaultRandom().primaryKey(),
  email: text('email').notNull(),
  name: text('name'),
  source: text('source'),
  metadata: jsonb('metadata'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

// ─── Singleton config (founder counter + bonus countdown) ─────────────────

export const founderCounter = anyimmi.table('founder_counter', {
  id: integer('id').primaryKey().default(1), // singleton row
  current: integer('current').default(287).notNull(),
  target: integer('target').default(500).notNull(),
  active: boolean('active').default(true).notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

export const bonusCountdown = anyimmi.table('bonus_countdown', {
  id: integer('id').primaryKey().default(1), // singleton row
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  bonusDescription: text('bonus_description').notNull(),
  active: boolean('active').default(true).notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

// ─── Site settings (key/value JSON store) ─────────────────────────────────

export const siteSettings = anyimmi.table('site_settings', {
  key: text('key').primaryKey(),
  value: jsonb('value'),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});
