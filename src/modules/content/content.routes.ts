import { Router } from "express";
import { Request, Response, NextFunction } from "express";
import { SliderImage } from "./sliderImage.model.js";
import { Testimonial } from "./testimonial.model.js";
import { Category } from "../assets/category.model.js";
import { SubCategory } from "../assets/subcategory.model.js";
import { Asset } from "../assets/asset.model.js";
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
    const key = "testimonials";
    const cached = contentCache.get(key);
    if (cached) {
      res.set("Cache-Control", CACHE_HEADER);
      return sendResponse(res, 200, cached);
    }
    const testimonials = await Testimonial.find({ isActive: true }).sort({ sortOrder: 1 });
    contentCache.set(key, testimonials);
    res.set("Cache-Control", CACHE_HEADER);
    sendResponse(res, 200, testimonials);
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

// Public: get assets for a category (by slug) — no file URLs exposed
router.get("/categories/:slug/items", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const slug = req.params.slug as string;
    const key = `cat-items:${slug}`;
    const cached = contentCache.get(key);
    if (cached) {
      res.set("Cache-Control", CACHE_HEADER);
      return sendResponse(res, 200, cached);
    }
    const category = await Category.findOne({ slug });
    if (!category) return sendResponse(res, 404, null, "Category not found");
    const assets = await Asset.find({ category: category._id })
      .select("name description fileFormat previewUrl tags")
      .sort({ name: 1 });
    contentCache.set(key, assets);
    res.set("Cache-Control", CACHE_HEADER);
    sendResponse(res, 200, assets);
  } catch (err) {
    next(err);
  }
});

// Public: get a single asset's public info (no file URL)
router.get("/items/:id", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = req.params.id as string;
    const key = `item:${id}`;
    const cached = contentCache.get(key);
    if (cached) {
      res.set("Cache-Control", CACHE_HEADER);
      return sendResponse(res, 200, cached);
    }
    const asset = await Asset.findById(id)
      .select("name description fileFormat previewUrl tags category")
      .populate("category", "name slug icon");
    if (!asset) return sendResponse(res, 404, null, "Item not found");
    contentCache.set(key, asset);
    res.set("Cache-Control", CACHE_HEADER);
    sendResponse(res, 200, asset);
  } catch (err) {
    next(err);
  }
});

export default router;
