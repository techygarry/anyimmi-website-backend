import { Router } from "express";
import { Request, Response, NextFunction } from "express";
import { SliderImage } from "./sliderImage.model.js";
import { Testimonial } from "./testimonial.model.js";
import { Category } from "../assets/category.model.js";
import { SubCategory } from "../assets/subcategory.model.js";
import { Asset } from "../assets/asset.model.js";
import { getFounderCounter } from "../admin/founderCounter.repo.js";
import { getBonusCountdown } from "../admin/bonusCountdown.repo.js";
import { sendResponse } from "../../utils/apiResponse.js";
import { contentCache } from "../../utils/cache.js";

const router = Router();
const CACHE_HEADER = "public, max-age=300, s-maxage=300";

// Public: get active slider images (optional ?type=xxx filter)
router.get("/slider-images", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const sliderType = (req.query as Record<string, string>).type || "";
    const key = sliderType ? `slider-images:${sliderType}` : "slider-images";
    const cached = contentCache.get(key);
    if (cached) {
      res.set("Cache-Control", CACHE_HEADER);
      return sendResponse(res, 200, cached);
    }
    const filter: Record<string, unknown> = { isActive: true };
    if (sliderType) filter.sliderType = sliderType;
    const images = await SliderImage.find(filter).sort({ sortOrder: 1 });
    contentCache.set(key, images);
    res.set("Cache-Control", CACHE_HEADER);
    sendResponse(res, 200, images);
  } catch (err) {
    next(err);
  }
});

// Public: get active testimonials
router.get("/testimonials", async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const key = "testimonials-pg";
    const cached = contentCache.get(key);
    if (cached) {
      res.set("Cache-Control", CACHE_HEADER);
      return sendResponse(res, 200, cached);
    }
    // Postgres-backed — reads from anyimmi.testimonials (demo + real).
    const { db } = await import("../../db/client.js");
    const { testimonials: T } = await import("../../db/schema/index.js");
    const { eq, asc } = await import("drizzle-orm");
    const rows = await db.select({
      _id: T.id,
      name: T.name,
      role: T.role,
      text: T.text,
      rating: T.rating,
      avatarColor: T.avatarColor,
    }).from(T).where(eq(T.isPublished, true)).orderBy(asc(T.sortOrder));
    contentCache.set(key, rows);
    res.set("Cache-Control", CACHE_HEADER);
    sendResponse(res, 200, rows);
  } catch (err) {
    next(err);
  }
});

// Public: get sub-categories for a category (by slug)
router.get("/categories/:slug/subcategories", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const slug = req.params.slug as string;
    const key = `subcats:${slug}`;
    const cached = contentCache.get(key);
    if (cached) {
      res.set("Cache-Control", CACHE_HEADER);
      return sendResponse(res, 200, cached);
    }
    const category = await Category.findOne({ slug });
    if (!category) return sendResponse(res, 404, null, "Category not found");
    const subs = await SubCategory.find({ category: category._id })
      .select("name slug description previewImages sortOrder")
      .sort({ sortOrder: 1 });
    contentCache.set(key, subs);
    res.set("Cache-Control", CACHE_HEADER);
    sendResponse(res, 200, subs);
  } catch (err) {
    next(err);
  }
});

// Public: get a single sub-category's public info
router.get("/subcategories/:id", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = req.params.id as string;
    const key = `subcat:${id}`;
    const cached = contentCache.get(key);
    if (cached) {
      res.set("Cache-Control", CACHE_HEADER);
      return sendResponse(res, 200, cached);
    }
    const sub = await SubCategory.findById(id)
      .select("name slug description previewImages category")
      .populate("category", "name slug icon");
    if (!sub) return sendResponse(res, 404, null, "Sub-category not found");
    contentCache.set(key, sub);
    res.set("Cache-Control", CACHE_HEADER);
    sendResponse(res, 200, sub);
  } catch (err) {
    next(err);
  }
});

// Public: get assets for a category (by slug) — Postgres-backed.
import { listCategoryItemsPg, getAssetPg } from "../assets/assets.public.pg.js";
router.get("/categories/:slug/items", listCategoryItemsPg);

// Public: get a single asset's public info — Postgres-backed.
router.get("/items/:id", getAssetPg);

// Public: founder seat counter (no cache — ticks up live as sales land)
router.get("/founder-counter", async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const doc = await getFounderCounter();
    const remaining = Math.max(0, doc.target - doc.current);
    res.set("Cache-Control", "no-store");
    sendResponse(res, 200, {
      current: doc.current,
      target: doc.target,
      remaining,
      active: doc.active,
    });
  } catch (err) {
    next(err);
  }
});

// Public: weekly bonus countdown deadline
router.get("/bonus-countdown", async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const doc = await getBonusCountdown();
    const secondsRemaining = Math.max(
      0,
      Math.floor((doc.expiresAt.getTime() - Date.now()) / 1000)
    );
    res.set("Cache-Control", "no-store");
    sendResponse(res, 200, {
      expiresAt: doc.expiresAt,
      bonusDescription: doc.bonusDescription,
      secondsRemaining,
      active: doc.active,
    });
  } catch (err) {
    next(err);
  }
});

export default router;
