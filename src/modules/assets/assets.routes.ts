import { Router } from "express";
import { authenticate } from "../../middleware/authenticate.js";
import {
  listAssets,
  getAsset,
  downloadAsset,
  bulkDownload,
  listCategories,
  getCategoryBySlug,
} from "./assets.controller.js";

const router = Router();

// Public
router.get("/categories", listCategories);
router.get("/categories/:slug", getCategoryBySlug);

// Auth required
router.get("/", authenticate, listAssets);
router.get("/:id", authenticate, getAsset);
router.get("/:id/download", authenticate, downloadAsset);
router.post("/bulk-download", authenticate, bulkDownload);

export default router;
