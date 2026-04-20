/**
 * Seed bundle categories + assets from the local 6.4 GB bundle folder.
 *
 * Source: ~/Downloads/AnyImmi/AnyImmi Bundle/  (27 dirs, ~305 files)
 * Sink:
 *   - Postgres anyimmi.bundle_categories + anyimmi.bundle_assets
 *   - Backend's local uploads/bundle/<category-slug>/<asset-filename>
 *
 * The frontend already serves /uploads/* statically (express.static at
 * /api/app.ts). For local dev this means asset URLs work as
 * `${API_URL}/uploads/bundle/<cat>/<file>` with no S3 needed.
 *
 * For PRODUCTION we'll switch the file-write step to S3 (DO Spaces).
 * The DB rows + URL contract stay identical — just swap the storage
 * driver. Per env: STORAGE_DRIVER=local (default) | s3.
 *
 * Idempotent: ON CONFLICT upserts. Safe to re-run.
 *
 * Run:  pnpm tsx src/scripts/seed-bundle-from-downloads.ts
 */

import { promises as fs } from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { db } from '../db/client';
import { bundleCategories, bundleAssets } from '../db/schema';
import { logger } from '../utils/logger';
import { eq } from 'drizzle-orm';

const BUNDLE_SOURCE = path.join(os.homedir(), 'Downloads/AnyImmi/AnyImmi Bundle');
const UPLOAD_ROOT = path.resolve(__dirname, '../../uploads/bundle');

// ─── Helpers ──────────────────────────────────────────────────────────────

function slugify(input: string): string {
  return input
    .toLowerCase()
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}

function titleize(name: string): string {
  return name
    .replace(/\.[^.]+$/, '')          // strip extension
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function inferFormat(filename: string): string {
  const ext = path.extname(filename).slice(1).toLowerCase();
  return ext.toUpperCase() || 'UNKNOWN';
}

const SKIP_FILES = new Set(['.DS_Store', 'Thumbs.db', '.gitkeep']);
const SKIP_DIR_PREFIX = ['.', '_'];

async function copyFile(src: string, dst: string) {
  await fs.mkdir(path.dirname(dst), { recursive: true });
  // Hardlink first (instant, zero disk), fallback to copy if cross-device.
  try {
    // Remove existing dst so link doesn't fail
    await fs.rm(dst, { force: true });
    await fs.link(src, dst);
  } catch {
    await fs.copyFile(src, dst);
  }
}

// ─── Walk + insert ─────────────────────────────────────────────────────────

async function walkCategory(catDir: string, sortOrder: number) {
  const catName = path.basename(catDir);
  const catSlug = slugify(catName);
  const isVault = catName.toLowerCase().includes('million dollar');

  // Upsert category
  const [catRow] = await db
    .insert(bundleCategories)
    .values({
      slug: catSlug,
      name: catName,
      description: isVault
        ? '12 high-value bonus assets — the assets that took 8 years and $1M+ to figure out.'
        : `${catName} — production-ready assets for Canadian RCICs.`,
      sortOrder,
      isLocked: isVault,
      unlockTier: isVault ? 'founder' : null,
      icon: 'folder',
      features: [],
      previewImages: [],
      useCases: [],
    })
    .onConflictDoUpdate({
      target: bundleCategories.slug,
      set: {
        name: catName,
        sortOrder,
        isLocked: isVault,
        unlockTier: isVault ? 'founder' : null,
        updatedAt: new Date(),
      },
    })
    .returning({ id: bundleCategories.id });

  const catId = catRow.id;

  // Walk files (1 level deep + recursively merge subfolders into single category for V1)
  const entries = await fs.readdir(catDir, { withFileTypes: true });
  let assetCount = 0;
  let assetSortOrder = 0;

  async function processFile(filename: string, fileSrcPath: string, subPath = '') {
    if (SKIP_FILES.has(filename)) return;
    if (filename.startsWith('._')) return; // macOS resource forks

    const stat = await fs.stat(fileSrcPath);
    if (!stat.isFile()) return;

    const title = titleize(filename);
    const baseSlug = slugify(subPath ? `${subPath}-${title}` : title);
    const ext = path.extname(filename);
    const assetSlug = baseSlug || `asset-${assetSortOrder}`;
    const fileFormat = inferFormat(filename);
    const dstFilename = `${assetSlug}${ext}`;
    const dstPath = path.join(UPLOAD_ROOT, catSlug, dstFilename);
    const publicPath = `/uploads/bundle/${catSlug}/${dstFilename}`;

    await copyFile(fileSrcPath, dstPath);

    await db
      .insert(bundleAssets)
      .values({
        categoryId: catId,
        slug: assetSlug,
        name: title,
        description: `${title} — ${fileFormat} asset from the AnyImmi Bundle.`,
        fileFormat,
        filePath: publicPath,
        fileSizeBytes: stat.size,
        previewUrl: ['JPG', 'JPEG', 'PNG', 'WEBP', 'GIF'].includes(fileFormat) ? publicPath : null,
        tags: [fileFormat.toLowerCase()],
        valueTier: isVault ? 'High' : 'Med',
        isPublished: true,
        version: 1,
      })
      .onConflictDoUpdate({
        target: [bundleAssets.categoryId, bundleAssets.slug],
        set: {
          name: title,
          fileFormat,
          filePath: publicPath,
          fileSizeBytes: stat.size,
          isPublished: true,
          updatedAt: new Date(),
        },
      });

    assetSortOrder++;
    assetCount++;
  }

  // Process top-level files
  for (const entry of entries) {
    if (entry.isFile()) {
      await processFile(entry.name, path.join(catDir, entry.name));
    } else if (entry.isDirectory()) {
      // V1 simplification: flatten subfolders into the parent category,
      // prefixing the asset name with the subfolder. Keeps URL structure
      // simple (1-level: /library/<cat>/<asset>) without losing files.
      if (SKIP_DIR_PREFIX.some((p) => entry.name.startsWith(p))) continue;
      const subDir = path.join(catDir, entry.name);
      const subPrefix = slugify(entry.name);
      const subEntries = await fs.readdir(subDir, { withFileTypes: true });
      for (const sub of subEntries) {
        if (sub.isFile()) {
          await processFile(sub.name, path.join(subDir, sub.name), subPrefix);
        }
        // Skip 3rd-level deep nesting for V1 (rare in this dataset).
      }
    }
  }

  return { catId, catSlug, catName, assetCount };
}

// ─── Main ──────────────────────────────────────────────────────────────────

async function main() {
  logger.info(`Seeding bundle from: ${BUNDLE_SOURCE}`);
  logger.info(`Writing files to:    ${UPLOAD_ROOT}`);

  // Ensure source exists
  try {
    await fs.access(BUNDLE_SOURCE);
  } catch {
    logger.error(`Source not found: ${BUNDLE_SOURCE}`);
    process.exit(1);
  }

  await fs.mkdir(UPLOAD_ROOT, { recursive: true });

  const entries = await fs.readdir(BUNDLE_SOURCE, { withFileTypes: true });
  const categoryDirs = entries
    .filter((e) => e.isDirectory() && !SKIP_DIR_PREFIX.some((p) => e.name.startsWith(p)))
    .map((e) => path.join(BUNDLE_SOURCE, e.name))
    .sort();

  logger.info(`Found ${categoryDirs.length} categories.`);

  let totalAssets = 0;
  let i = 0;
  for (const catDir of categoryDirs) {
    i++;
    process.stdout.write(`\n[${i}/${categoryDirs.length}] ${path.basename(catDir)} ... `);
    const result = await walkCategory(catDir, i);
    totalAssets += result.assetCount;
    process.stdout.write(`${result.assetCount} assets`);
  }

  // Tally
  const [{ count: catCount }] = (await import('../db/client')).sql.unsafe ? [] : ([] as any);
  void catCount;
  console.log('\n');
  logger.info(`Done. ${categoryDirs.length} categories, ${totalAssets} assets seeded.`);

  // Verify counts
  const cats = await db.select().from(bundleCategories);
  const assets = await db.select().from(bundleAssets);
  logger.info(`Postgres now has ${cats.length} categories, ${assets.length} assets.`);

  // Sample
  for (const c of cats.slice(0, 3)) {
    const inCat = assets.filter((a) => a.categoryId === c.id);
    logger.info(`  ${c.name} → ${inCat.length} assets`);
  }
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('Seed failed:', err);
    process.exit(1);
  });
