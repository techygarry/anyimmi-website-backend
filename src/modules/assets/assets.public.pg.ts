/**
 * Public bundle-asset reads from Postgres (anyimmi.* schema).
 *
 * Replaces the Mongoose listCategories / getCategoryBySlug / listAssets /
 * getAsset paths for the PUBLIC marketing flow. Admin write paths still
 * use Mongoose for now (out of scope for the migration sprint).
 *
 * Wired into:
 *   - GET /api/assets/categories          -> listCategoriesPg
 *   - GET /api/assets/categories/:slug    -> getCategoryBySlugPg
 *   - GET /api/content/categories/:slug/items -> listCategoryItemsPg
 *   - GET /api/content/items/:id          -> getAssetPg
 */

import { Request, Response, NextFunction } from 'express';
import { eq, sql, and } from 'drizzle-orm';
import { db } from '../../db/client';
import { bundleCategories, bundleAssets } from '../../db/schema';
import { sendResponse } from '../../utils/apiResponse';

export async function listCategoriesPg(_req: Request, res: Response, next: NextFunction) {
  try {
    // Two simple queries + merge in JS — cheaper than a correlated
    // subquery and easier to debug than Drizzle's sql`` interpolation.
    const cats = await db
      .select()
      .from(bundleCategories)
      .orderBy(bundleCategories.sortOrder);

    const counts = await db
      .select({
        categoryId: bundleAssets.categoryId,
        n: sql<number>`COUNT(*)::int`,
      })
      .from(bundleAssets)
      .where(eq(bundleAssets.isPublished, true))
      .groupBy(bundleAssets.categoryId);

    const countMap = new Map(counts.map((r) => [r.categoryId, Number(r.n)]));

    const rows = cats.map((c) => ({
      _id: c.id,
      slug: c.slug,
      name: c.name,
      description: c.description,
      longDescription: c.longDescription,
      icon: c.icon,
      image: c.image,
      fileCount: c.fileCount,
      features: c.features,
      previewImages: c.previewImages,
      useCases: c.useCases,
      sortOrder: c.sortOrder,
      isLocked: c.isLocked,
      unlockTier: c.unlockTier,
      assetCount: countMap.get(c.id) ?? 0,
    }));

    res.set('Cache-Control', 'public, max-age=60, s-maxage=300');
    sendResponse(res, 200, rows);
  } catch (err) {
    next(err);
  }
}

export async function getCategoryBySlugPg(req: Request, res: Response, next: NextFunction) {
  try {
    const slug = req.params.slug as string;
    const [row] = await db
      .select()
      .from(bundleCategories)
      .where(eq(bundleCategories.slug, slug))
      .limit(1);
    if (!row) return sendResponse(res, 404, { error: { code: 'not_found', message: 'Category not found' } });

    const assetCount = await db
      .select({ count: sql<number>`COUNT(*)::int` })
      .from(bundleAssets)
      .where(and(eq(bundleAssets.categoryId, row.id), eq(bundleAssets.isPublished, true)));

    sendResponse(res, 200, { ...row, _id: row.id, assetCount: assetCount[0]?.count ?? 0 });
  } catch (err) {
    next(err);
  }
}

export async function listCategoryItemsPg(req: Request, res: Response, next: NextFunction) {
  try {
    const slug = req.params.slug as string;
    const [cat] = await db
      .select()
      .from(bundleCategories)
      .where(eq(bundleCategories.slug, slug))
      .limit(1);
    if (!cat) return sendResponse(res, 404, { error: { code: 'not_found', message: 'Category not found' } });

    const items = await db
      .select({
        _id: bundleAssets.id,
        slug: bundleAssets.slug,
        name: bundleAssets.name,
        description: bundleAssets.description,
        fileFormat: bundleAssets.fileFormat,
        fileSizeBytes: bundleAssets.fileSizeBytes,
        previewUrl: bundleAssets.previewUrl,
        previewThumbnailUrl: bundleAssets.previewThumbnailUrl,
        tags: bundleAssets.tags,
        downloadCount: bundleAssets.downloadCount,
        valueTier: bundleAssets.valueTier,
      })
      .from(bundleAssets)
      .where(and(eq(bundleAssets.categoryId, cat.id), eq(bundleAssets.isPublished, true)))
      .orderBy(bundleAssets.name);

    res.set('Cache-Control', 'public, max-age=60, s-maxage=300');
    sendResponse(res, 200, items);
  } catch (err) {
    next(err);
  }
}

export async function getAssetPg(req: Request, res: Response, next: NextFunction) {
  try {
    const id = req.params.id as string;
    const [row] = await db
      .select()
      .from(bundleAssets)
      .where(eq(bundleAssets.id, id))
      .limit(1);
    if (!row) return sendResponse(res, 404, { error: { code: 'not_found', message: 'Asset not found' } });

    const [cat] = await db
      .select({ id: bundleCategories.id, name: bundleCategories.name, slug: bundleCategories.slug, icon: bundleCategories.icon })
      .from(bundleCategories)
      .where(eq(bundleCategories.id, row.categoryId))
      .limit(1);

    sendResponse(res, 200, {
      ...row,
      _id: row.id,
      category: cat ? { _id: cat.id, name: cat.name, slug: cat.slug, icon: cat.icon } : null,
    });
  } catch (err) {
    next(err);
  }
}
