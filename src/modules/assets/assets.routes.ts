import { Router } from "express";
import { authenticate } from "../../middleware/authenticate.js";
import {
  listAssets,
  getAsset,
  downloadAsset,
  bulkDownload,
} from "./assets.controller.js";
// Public categories now read from Postgres (anyimmi.* schema, seeded
// with 26 categories + 555 assets from the Bundle source folder).
// Mongo controller still imported for the auth-required admin paths
// below that depend on it.
import {
  listCategoriesPg,
  getCategoryBySlugPg,
} from "./assets.public.pg.js";

const router = Router();

// Public — Postgres-backed
router.get("/categories", listCategoriesPg);
router.get("/categories/:slug", getCategoryBySlugPg);

// Auth required
router.get("/", authenticate, listAssets);
router.get("/:id", authenticate, getAsset);
router.get("/:id/download", authenticate, downloadAsset);
router.post("/bulk-download", authenticate, bulkDownload);

export default router;
