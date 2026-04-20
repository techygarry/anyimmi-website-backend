--> statement-breakpoint
CREATE TYPE "anyimmi"."entitlement_source" AS ENUM('subscription', 'bundle-founder', 'trial', 'manual');--> statement-breakpoint
CREATE TYPE "anyimmi"."entitlement_status" AS ENUM('active', 'past_due', 'canceled', 'trialing');--> statement-breakpoint
CREATE TYPE "anyimmi"."order_status" AS ENUM('pending', 'paid', 'refunded', 'failed');--> statement-breakpoint
CREATE TYPE "anyimmi"."org_type" AS ENUM('solo', 'firm');--> statement-breakpoint
CREATE TYPE "anyimmi"."product" AS ENUM('bundle', 'ai-tools', 'crm', 'dossiar', 'portal-pro');--> statement-breakpoint
CREATE TYPE "anyimmi"."user_role" AS ENUM('owner', 'admin', 'member', 'viewer', 'billing_only', 'super_admin');--> statement-breakpoint
CREATE TABLE "anyimmi"."bonus_countdown" (
	"id" integer PRIMARY KEY DEFAULT 1 NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"bonus_description" text NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "anyimmi"."bundle_assets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"category_id" uuid NOT NULL,
	"subcategory_id" uuid,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"file_format" text,
	"file_path" text,
	"file_size_bytes" bigint,
	"preview_url" text,
	"preview_thumbnail_url" text,
	"preview_pages" jsonb DEFAULT '[]'::jsonb,
	"page_count" integer,
	"tags" jsonb DEFAULT '[]'::jsonb,
	"download_count" integer DEFAULT 0 NOT NULL,
	"favorite_count" integer DEFAULT 0 NOT NULL,
	"value_tier" text,
	"is_published" boolean DEFAULT false NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"legacy_mongo_id" varchar(24),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "anyimmi"."bundle_categories" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"long_description" text,
	"icon" text,
	"image" text,
	"file_count" text,
	"features" jsonb DEFAULT '[]'::jsonb,
	"preview_images" jsonb DEFAULT '[]'::jsonb,
	"use_cases" jsonb DEFAULT '[]'::jsonb,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"is_locked" boolean DEFAULT false NOT NULL,
	"unlock_tier" text,
	"legacy_mongo_id" varchar(24),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "anyimmi"."bundle_downloads" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid,
	"asset_id" uuid NOT NULL,
	"org_id" uuid,
	"ip" text,
	"user_agent" text,
	"downloaded_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "anyimmi"."bundle_subcategories" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"category_id" uuid NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"format" text,
	"preview_images" jsonb DEFAULT '[]'::jsonb,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"legacy_mongo_id" varchar(24),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "anyimmi"."contact_submissions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"phone" text,
	"message" text NOT NULL,
	"source" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "anyimmi"."entitlements" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"org_id" uuid,
	"product" "anyimmi"."product" NOT NULL,
	"tier" text NOT NULL,
	"status" "anyimmi"."entitlement_status" DEFAULT 'active' NOT NULL,
	"source" "anyimmi"."entitlement_source",
	"expires_at" timestamp with time zone,
	"external_ref" text,
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "anyimmi"."founder_counter" (
	"id" integer PRIMARY KEY DEFAULT 1 NOT NULL,
	"current" integer DEFAULT 287 NOT NULL,
	"target" integer DEFAULT 500 NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "anyimmi"."leads" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text NOT NULL,
	"name" text,
	"source" text,
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "anyimmi"."orders" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid,
	"email" text NOT NULL,
	"tier" text NOT NULL,
	"amount_cents" integer NOT NULL,
	"currency" varchar(8) DEFAULT 'usd' NOT NULL,
	"status" "anyimmi"."order_status" DEFAULT 'pending' NOT NULL,
	"stripe_checkout_session_id" text,
	"stripe_payment_intent_id" text,
	"invoice_number" text,
	"metadata" jsonb,
	"paid_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "anyimmi"."org_members" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"role" "anyimmi"."user_role" DEFAULT 'member' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "anyimmi"."organizations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"type" "anyimmi"."org_type" DEFAULT 'solo' NOT NULL,
	"name" text NOT NULL,
	"owner_user_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "anyimmi"."site_settings" (
	"key" text PRIMARY KEY NOT NULL,
	"value" jsonb,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "anyimmi"."slider_images" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title" text,
	"image_url" text NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"is_published" boolean DEFAULT true NOT NULL,
	"legacy_mongo_id" varchar(24),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "anyimmi"."testimonials" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"role" text,
	"text" text NOT NULL,
	"rating" integer DEFAULT 5 NOT NULL,
	"avatar_color" text,
	"is_published" boolean DEFAULT true NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"legacy_mongo_id" varchar(24),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "anyimmi"."users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text NOT NULL,
	"name" text,
	"password_hash" text,
	"role" "anyimmi"."user_role" DEFAULT 'owner' NOT NULL,
	"legacy_mongo_id" varchar(24),
	"portal_pro_expires_at" timestamp with time zone,
	"email_verified_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "anyimmi"."bundle_assets" ADD CONSTRAINT "bundle_assets_category_id_bundle_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "anyimmi"."bundle_categories"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "anyimmi"."bundle_assets" ADD CONSTRAINT "bundle_assets_subcategory_id_bundle_subcategories_id_fk" FOREIGN KEY ("subcategory_id") REFERENCES "anyimmi"."bundle_subcategories"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "anyimmi"."bundle_downloads" ADD CONSTRAINT "bundle_downloads_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "anyimmi"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "anyimmi"."bundle_downloads" ADD CONSTRAINT "bundle_downloads_asset_id_bundle_assets_id_fk" FOREIGN KEY ("asset_id") REFERENCES "anyimmi"."bundle_assets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "anyimmi"."bundle_downloads" ADD CONSTRAINT "bundle_downloads_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "anyimmi"."organizations"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "anyimmi"."bundle_subcategories" ADD CONSTRAINT "bundle_subcategories_category_id_bundle_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "anyimmi"."bundle_categories"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "anyimmi"."entitlements" ADD CONSTRAINT "entitlements_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "anyimmi"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "anyimmi"."entitlements" ADD CONSTRAINT "entitlements_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "anyimmi"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "anyimmi"."orders" ADD CONSTRAINT "orders_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "anyimmi"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "anyimmi"."org_members" ADD CONSTRAINT "org_members_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "anyimmi"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "anyimmi"."org_members" ADD CONSTRAINT "org_members_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "anyimmi"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "anyimmi"."organizations" ADD CONSTRAINT "organizations_owner_user_id_users_id_fk" FOREIGN KEY ("owner_user_id") REFERENCES "anyimmi"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "bundle_assets_cat_slug_ux" ON "anyimmi"."bundle_assets" USING btree ("category_id","slug");--> statement-breakpoint
CREATE INDEX "bundle_assets_published_ix" ON "anyimmi"."bundle_assets" USING btree ("is_published");--> statement-breakpoint
CREATE UNIQUE INDEX "bundle_categories_slug_ux" ON "anyimmi"."bundle_categories" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "bundle_categories_legacy_ix" ON "anyimmi"."bundle_categories" USING btree ("legacy_mongo_id");--> statement-breakpoint
CREATE INDEX "bundle_downloads_user_ix" ON "anyimmi"."bundle_downloads" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "bundle_downloads_asset_ix" ON "anyimmi"."bundle_downloads" USING btree ("asset_id");--> statement-breakpoint
CREATE UNIQUE INDEX "bundle_subcategories_cat_slug_ux" ON "anyimmi"."bundle_subcategories" USING btree ("category_id","slug");--> statement-breakpoint
CREATE UNIQUE INDEX "entitlements_user_product_ux" ON "anyimmi"."entitlements" USING btree ("user_id","product");--> statement-breakpoint
CREATE INDEX "entitlements_status_ix" ON "anyimmi"."entitlements" USING btree ("status");--> statement-breakpoint
CREATE INDEX "entitlements_expires_ix" ON "anyimmi"."entitlements" USING btree ("expires_at");--> statement-breakpoint
CREATE UNIQUE INDEX "orders_session_ux" ON "anyimmi"."orders" USING btree ("stripe_checkout_session_id");--> statement-breakpoint
CREATE INDEX "orders_email_ix" ON "anyimmi"."orders" USING btree ("email");--> statement-breakpoint
CREATE UNIQUE INDEX "org_members_org_user_ux" ON "anyimmi"."org_members" USING btree ("org_id","user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "users_email_ux" ON "anyimmi"."users" USING btree ("email");--> statement-breakpoint
CREATE INDEX "users_legacy_mongo_ix" ON "anyimmi"."users" USING btree ("legacy_mongo_id");