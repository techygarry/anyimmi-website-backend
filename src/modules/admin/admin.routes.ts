import { Router } from "express";
import fs from "fs";
import path from "path";
import multer from "multer";
import { authenticate } from "../../middleware/authenticate.js";
import { authorize } from "../../middleware/authorize.js";
import {
  getDashboard,
  getUsers,
  getUser,
  updateUser,
  deleteUser,
  getOrders,
  updateOrderStatus,
  downloadInvoice,
  getAssets,
  createAsset,
  updateAsset,
  deleteAsset,
  getCategories,
  createCategory,
  updateCategory,
  deleteCategory,
  getSubCategories,
  createSubCategory,
  updateSubCategory,
  deleteSubCategory,
  getSettings,
  updateSetting,
  getSliderImages,
  createSliderImage,
  bulkCreateSliderImages,
  updateSliderImage,
  deleteSliderImage,
  getTestimonials,
  createTestimonial,
  updateTestimonial,
  deleteTestimonial,
  getContacts,
  updateContact,
  deleteContact,
  getFounderCounterAdmin,
  patchFounderCounter,
  getBonusCountdownAdmin,
  patchBonusCountdown,
} from "./admin.controller.js";

const router = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 50 * 1024 * 1024 } });

// Separate diskStorage for category images — NOT mixed with S3 asset uploads
const CATEGORY_UPLOAD_DIR = path.join(__dirname, "../../../uploads/categories");
fs.mkdirSync(CATEGORY_UPLOAD_DIR, { recursive: true });

const categoryUpload = multer({
  storage: multer.diskStorage({
    destination: CATEGORY_UPLOAD_DIR,
    filename: (_req, file, cb) => {
      const ext = path.extname(file.originalname);
      cb(null, `${Date.now()}-${Math.round(Math.random() * 1e6)}${ext}`);
    },
  }),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (file.mimetype.startsWith("image/")) cb(null, true);
    else cb(new Error("Only image files are allowed"));
  },
});

router.use(authenticate, authorize("admin"));

// Dashboard
router.get("/dashboard", getDashboard);

// Users
router.get("/users", getUsers);
router.get("/users/:id", getUser);
router.patch("/users/:id", updateUser);
router.delete("/users/:id", deleteUser);

// Orders
router.get("/orders", getOrders);
router.patch("/orders/:id", updateOrderStatus);
router.get("/orders/:id/invoice", downloadInvoice);

// Assets
router.get("/assets", getAssets);
router.post("/assets", upload.single("file"), createAsset);
router.patch("/assets/:id", updateAsset);
router.delete("/assets/:id", deleteAsset);

// Categories (image = main category image, previewFiles = gallery previews)
const categoryFields = categoryUpload.fields([
  { name: "image", maxCount: 1 },
  { name: "previewFiles", maxCount: 20 },
]);
router.get("/categories", getCategories);
router.post("/categories", categoryFields, createCategory);
router.patch("/categories/:id", categoryFields, updateCategory);
router.delete("/categories/:id", deleteCategory);

// Sub-Categories (local disk storage for preview images)
const SUBCATEGORY_UPLOAD_DIR = path.join(__dirname, "../../../uploads/subcategories");
fs.mkdirSync(SUBCATEGORY_UPLOAD_DIR, { recursive: true });

const subCategoryUpload = multer({
  storage: multer.diskStorage({
    destination: SUBCATEGORY_UPLOAD_DIR,
    filename: (_req, file, cb) => {
      const ext = path.extname(file.originalname);
      cb(null, `${Date.now()}-${Math.round(Math.random() * 1e6)}${ext}`);
    },
  }),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (file.mimetype.startsWith("image/")) cb(null, true);
    else cb(new Error("Only image files are allowed"));
  },
});

const subCategoryFields = subCategoryUpload.fields([
  { name: "previewFiles", maxCount: 20 },
]);
router.get("/subcategories", getSubCategories);
router.post("/subcategories", subCategoryFields, createSubCategory);
router.patch("/subcategories/:id", subCategoryFields, updateSubCategory);
router.delete("/subcategories/:id", deleteSubCategory);

// Settings
router.get("/settings", getSettings);
router.put("/settings/:key", updateSetting);

// Slider Images (local disk storage)
const SLIDER_UPLOAD_DIR = path.join(__dirname, "../../../uploads/slider");
fs.mkdirSync(SLIDER_UPLOAD_DIR, { recursive: true });

const sliderUpload = multer({
  storage: multer.diskStorage({
    destination: SLIDER_UPLOAD_DIR,
    filename: (_req, file, cb) => {
      const ext = path.extname(file.originalname);
      cb(null, `${Date.now()}-${Math.round(Math.random() * 1e6)}${ext}`);
    },
  }),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (file.mimetype.startsWith("image/")) cb(null, true);
    else cb(new Error("Only image files are allowed"));
  },
});

router.get("/slider-images", getSliderImages);
router.post("/slider-images", sliderUpload.single("image"), createSliderImage);
router.post("/slider-images/bulk", sliderUpload.array("images", 50), bulkCreateSliderImages);
router.patch("/slider-images/:id", updateSliderImage);
router.delete("/slider-images/:id", deleteSliderImage);

// Video Testimonials
router.get("/testimonials", getTestimonials);
router.post("/testimonials", createTestimonial);
router.patch("/testimonials/:id", updateTestimonial);
router.delete("/testimonials/:id", deleteTestimonial);

// Contacts
router.get("/contacts", getContacts);
router.patch("/contacts/:id", updateContact);
router.delete("/contacts/:id", deleteContact);

// Founder counter (forcing-function: seat count for THE FOUNDER tier)
router.get("/founder-counter", getFounderCounterAdmin);
router.patch("/founder-counter", patchFounderCounter);

// Weekly bonus countdown
router.get("/bonus-countdown", getBonusCountdownAdmin);
router.patch("/bonus-countdown", patchBonusCountdown);

export default router;
