import { Router } from "express";
import multer from "multer";
import { authenticate } from "../../middleware/authenticate.js";
import { validate } from "../../middleware/validate.js";
import { updateProfileSchema, changePasswordSchema } from "./users.validator.js";
import {
  getMe,
  updateProfile,
  uploadAvatar,
  changePassword,
  getFavorites,
  addFavorite,
  removeFavorite,
  getDownloads,
  getStats,
} from "./users.controller.js";

const router = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } });

router.use(authenticate);

router.get("/me", getMe);
router.patch("/me", validate(updateProfileSchema), updateProfile);
router.patch("/me/avatar", upload.single("avatar"), uploadAvatar);
router.patch("/me/password", validate(changePasswordSchema), changePassword);
router.get("/me/favorites", getFavorites);
router.post("/me/favorites/:assetId", addFavorite);
router.delete("/me/favorites/:assetId", removeFavorite);
router.get("/me/downloads", getDownloads);
router.get("/me/stats", getStats);

export default router;
