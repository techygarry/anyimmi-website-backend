import { Request, Response, NextFunction } from "express";
import fs from "fs";
import path from "path";
import { User } from "../users/user.model.js";
import { Order } from "../payments/order.model.js";
import { Asset } from "../assets/asset.model.js";
import { Category } from "../assets/category.model.js";
import { SubCategory } from "../assets/subcategory.model.js";
import { Download } from "../assets/download.model.js";
import { SiteSetting } from "./siteSetting.model.js";
import { SliderImage } from "../content/sliderImage.model.js";
import { Testimonial } from "../content/testimonial.model.js";
import { Contact } from "../contact/contact.model.js";
import { sendResponse, sendPaginated } from "../../utils/apiResponse.js";
import { AppError } from "../../utils/apiError.js";
import { clearContentCache } from "../../utils/cache.js";
import { PutObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";
import { s3Client } from "../../config/spaces.js";
import { env } from "../../config/env.js";
import { generateInvoicePDF } from "../payments/invoice.pdf.js";

const CATEGORY_UPLOADS_DIR = path.join(__dirname, "../../../uploads/categories");
const SUBCATEGORY_UPLOADS_DIR = path.join(__dirname, "../../../uploads/subcategories");
const SLIDER_UPLOADS_DIR = path.join(__dirname, "../../../uploads/slider");

/** Remove a local category image file if it exists */
function removeCategoryFile(imageUrl: string | undefined) {
  if (!imageUrl || !imageUrl.startsWith("/uploads/categories/")) return;
  const filename = imageUrl.replace("/uploads/categories/", "");
  const filePath = path.join(CATEGORY_UPLOADS_DIR, filename);
  fs.unlink(filePath, () => {}); // fire-and-forget
}

/** Remove a local subcategory image file if it exists */
function removeSubCategoryFile(imageUrl: string | undefined) {
  if (!imageUrl || !imageUrl.startsWith("/uploads/subcategories/")) return;
  const filename = imageUrl.replace("/uploads/subcategories/", "");
  const filePath = path.join(SUBCATEGORY_UPLOADS_DIR, filename);
  fs.unlink(filePath, () => {});
}

/** Remove a local slider image file if it exists */
function removeSliderFile(imageUrl: string | undefined) {
  if (!imageUrl || !imageUrl.startsWith("/uploads/slider/")) return;
  const filename = imageUrl.replace("/uploads/slider/", "");
  const filePath = path.join(SLIDER_UPLOADS_DIR, filename);
  fs.unlink(filePath, () => {}); // fire-and-forget
}

// ─── Dashboard ──────────────────────────────────────────────
export const getDashboard = async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const [
      totalUsers,
      totalOrders,
      revenueResult,
      ordersToday,
      activeProUsers,
      totalAssets,
      totalDownloads,
      recentOrders,
      recentUsers,
      usersByPlan,
      revenueByDay,
    ] = await Promise.all([
      User.countDocuments(),
      Order.countDocuments({ status: "completed" }),
      Order.aggregate([
        { $match: { status: "completed" } },
        { $group: { _id: null, total: { $sum: "$amount" } } },
      ]),
      Order.countDocuments({ createdAt: { $gte: today }, status: "completed" }),
      User.countDocuments({ plan: { $in: ["pro", "business"] } }),
      Asset.countDocuments(),
      Download.countDocuments(),
      Order.find({ status: "completed" })
        .sort({ createdAt: -1 })
        .limit(10)
        .populate("userId", "name email"),
      User.find()
        .sort({ createdAt: -1 })
        .limit(5)
        .select("name email plan role createdAt"),
      User.aggregate([
        { $group: { _id: "$plan", count: { $sum: 1 } } },
      ]),
      Order.aggregate([
        { $match: { status: "completed", createdAt: { $gte: thirtyDaysAgo } } },
        {
          $group: {
            _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
            revenue: { $sum: "$amount" },
            count: { $sum: 1 },
          },
        },
        { $sort: { _id: 1 } },
      ]),
    ]);

    sendResponse(res, 200, {
      totalUsers,
      totalOrders,
      totalRevenue: revenueResult[0]?.total || 0,
      ordersToday,
      activeProUsers,
      totalAssets,
      totalDownloads,
      recentOrders,
      recentUsers,
      usersByPlan,
      revenueByDay,
    });
  } catch (err) {
    next(err);
  }
};

// ─── Users ──────────────────────────────────────────────────
export const getUsers = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const { plan, role, search } = req.query;

    const filter: Record<string, unknown> = {};
    if (plan) filter.plan = plan;
    if (role) filter.role = role;
    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: "i" } },
        { email: { $regex: search, $options: "i" } },
      ];
    }

    const [users, total] = await Promise.all([
      User.find(filter)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit),
      User.countDocuments(filter),
    ]);

    sendPaginated(res, users, total, page, limit);
  } catch (err) {
    next(err);
  }
};

export const getUser = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) throw new AppError("User not found", 404);
    sendResponse(res, 200, user);
  } catch (err) {
    next(err);
  }
};

export const updateUser = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { role, plan, name, email, isEmailVerified } = req.body;
    const update: Record<string, unknown> = {};
    if (role !== undefined) update.role = role;
    if (plan !== undefined) update.plan = plan;
    if (name !== undefined) update.name = name;
    if (email !== undefined) update.email = email;
    if (isEmailVerified !== undefined) update.isEmailVerified = isEmailVerified;

    const user = await User.findByIdAndUpdate(req.params.id, update, { new: true });
    if (!user) throw new AppError("User not found", 404);
    sendResponse(res, 200, user, "User updated");
  } catch (err) {
    next(err);
  }
};

export const deleteUser = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = await User.findByIdAndDelete(req.params.id);
    if (!user) throw new AppError("User not found", 404);
    sendResponse(res, 200, null, "User deleted");
  } catch (err) {
    next(err);
  }
};

// ─── Orders ─────────────────────────────────────────────────
export const getOrders = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const { tier, status, deliveryStatus } = req.query;

    const filter: Record<string, unknown> = {};
    if (tier) filter.tier = tier;
    if (status) filter.status = status;
    if (deliveryStatus) filter.deliveryStatus = deliveryStatus;

    const [orders, total] = await Promise.all([
      Order.find(filter)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .populate("userId", "name email"),
      Order.countDocuments(filter),
    ]);

    sendPaginated(res, orders, total, page, limit);
  } catch (err) {
    next(err);
  }
};

export const updateOrderStatus = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { deliveryStatus } = req.body;
    const validStatuses = [
      "pending",
      "email_sent",
      "intake_sent",
      "branding_delivered",
      "website_delivered",
    ];

    if (!validStatuses.includes(deliveryStatus)) {
      throw new AppError("Invalid delivery status", 400);
    }

    const order = await Order.findByIdAndUpdate(
      req.params.id,
      { deliveryStatus },
      { new: true }
    );

    if (!order) {
      throw new AppError("Order not found", 404);
    }

    sendResponse(res, 200, order, "Order status updated");
  } catch (err) {
    next(err);
  }
};

export const downloadInvoice = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const order = await Order.findById(req.params.id);
    if (!order) throw new AppError("Order not found", 404);

    const fileName = `invoice-${order.invoiceNumber || order._id}.pdf`;

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="${fileName}"`);

    const pdfDoc = generateInvoicePDF(order);
    pdfDoc.pipe(res);
  } catch (err) {
    next(err);
  }
};

// ─── Assets ─────────────────────────────────────────────────
export const getAssets = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const { category, fileFormat, search } = req.query;

    const filter: Record<string, unknown> = {};
    if (category) filter.category = category;
    if (fileFormat) filter.fileFormat = fileFormat;
    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: "i" } },
        { description: { $regex: search, $options: "i" } },
      ];
    }

    const [assets, total] = await Promise.all([
      Asset.find(filter)
        .populate("category", "name slug")
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit),
      Asset.countDocuments(filter),
    ]);

    sendPaginated(res, assets, total, page, limit);
  } catch (err) {
    next(err);
  }
};

export const createAsset = async (req: Request, res: Response, next: NextFunction) => {
  try {
    // Determine source type: "drive" if driveUrl provided, otherwise "spaces"
    const sourceType = req.body.sourceType || (req.body.driveUrl ? "drive" : "spaces");
    req.body.sourceType = sourceType;

    if (sourceType === "spaces" && req.file) {
      const key = `assets/${Date.now()}-${req.file.originalname}`;
      await s3Client.send(
        new PutObjectCommand({
          Bucket: env.DO_SPACES_BUCKET,
          Key: key,
          Body: req.file.buffer,
          ContentType: req.file.mimetype,
        })
      );
      req.body.fileUrl = `${env.DO_SPACES_ENDPOINT}/${env.DO_SPACES_BUCKET}/${key}`;
    }

    // FormData sends booleans as strings
    if (typeof req.body.isFree === "string") {
      req.body.isFree = req.body.isFree === "true";
    }

    const asset = await Asset.create(req.body);
    sendResponse(res, 201, asset, "Asset created");
  } catch (err) {
    next(err);
  }
};

export const updateAsset = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const asset = await Asset.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true,
    });

    if (!asset) {
      throw new AppError("Asset not found", 404);
    }

    sendResponse(res, 200, asset, "Asset updated");
  } catch (err) {
    next(err);
  }
};

export const deleteAsset = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const asset = await Asset.findById(req.params.id);
    if (!asset) throw new AppError("Asset not found", 404);

    // Only delete from S3 if the asset was uploaded to Spaces
    if (asset.sourceType !== "drive" && asset.fileUrl) {
      const key = asset.fileUrl.replace(
        `${env.DO_SPACES_ENDPOINT}/${env.DO_SPACES_BUCKET}/`,
        ""
      );
      try {
        await s3Client.send(
          new DeleteObjectCommand({ Bucket: env.DO_SPACES_BUCKET, Key: key })
        );
      } catch {
        // File may not exist in storage, continue with DB deletion
      }
    }

    await Asset.findByIdAndDelete(req.params.id);
    sendResponse(res, 200, null, "Asset deleted");
  } catch (err) {
    next(err);
  }
};

// ─── Categories ─────────────────────────────────────────────
export const getCategories = async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const categories = await Category.find().sort({ sortOrder: 1 });
    sendResponse(res, 200, categories);
  } catch (err) {
    next(err);
  }
};

export const createCategory = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const files = req.files as { [field: string]: Express.Multer.File[] } | undefined;

    // Main category image
    if (files?.image?.[0]) {
      req.body.image = `/uploads/categories/${files.image[0].filename}`;
    }

    // Preview image files — merge with any existing URL strings sent via FormData
    let existingPreviews: string[] = [];
    if (typeof req.body.previewImages === "string") {
      existingPreviews = JSON.parse(req.body.previewImages);
    }
    const uploadedPreviews = (files?.previewFiles || []).map(
      (f) => `/uploads/categories/${f.filename}`
    );
    req.body.previewImages = [...existingPreviews, ...uploadedPreviews];

    // FormData sends arrays as strings
    if (typeof req.body.features === "string") req.body.features = JSON.parse(req.body.features);
    if (typeof req.body.useCases === "string") req.body.useCases = JSON.parse(req.body.useCases);
    if (typeof req.body.sortOrder === "string") req.body.sortOrder = parseInt(req.body.sortOrder) || 0;

    const category = await Category.create(req.body);
    clearContentCache();
    sendResponse(res, 201, category, "Category created");
  } catch (err) {
    next(err);
  }
};

export const updateCategory = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const files = req.files as { [field: string]: Express.Multer.File[] } | undefined;
    const existing = await Category.findById(req.params.id).select("image previewImages");

    // Main category image — replace old one if new upload
    if (files?.image?.[0]) {
      if (existing) removeCategoryFile(existing.image);
      req.body.image = `/uploads/categories/${files.image[0].filename}`;
    }

    // Preview images: keep existing ones the client sent back, add new uploads
    let keptPreviews: string[] = [];
    if (typeof req.body.previewImages === "string") {
      keptPreviews = JSON.parse(req.body.previewImages);
    }
    const uploadedPreviews = (files?.previewFiles || []).map(
      (f) => `/uploads/categories/${f.filename}`
    );
    req.body.previewImages = [...keptPreviews, ...uploadedPreviews];

    // Clean up removed preview images (ones that existed before but aren't in the kept list)
    if (existing?.previewImages) {
      for (const oldImg of existing.previewImages) {
        if (!keptPreviews.includes(oldImg)) {
          removeCategoryFile(oldImg);
        }
      }
    }

    // FormData sends arrays as strings
    if (typeof req.body.features === "string") req.body.features = JSON.parse(req.body.features);
    if (typeof req.body.useCases === "string") req.body.useCases = JSON.parse(req.body.useCases);
    if (typeof req.body.sortOrder === "string") req.body.sortOrder = parseInt(req.body.sortOrder) || 0;

    const category = await Category.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true,
    });
    if (!category) throw new AppError("Category not found", 404);
    clearContentCache();
    sendResponse(res, 200, category, "Category updated");
  } catch (err) {
    next(err);
  }
};

export const deleteCategory = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const assetCount = await Asset.countDocuments({ category: req.params.id });
    if (assetCount > 0) {
      throw new AppError(`Cannot delete category with ${assetCount} assets. Move or delete them first.`, 400);
    }
    const category = await Category.findByIdAndDelete(req.params.id);
    if (!category) throw new AppError("Category not found", 404);
    // Clean up uploaded image + preview images
    removeCategoryFile(category.image);
    for (const img of category.previewImages || []) {
      removeCategoryFile(img);
    }
    clearContentCache();
    sendResponse(res, 200, null, "Category deleted");
  } catch (err) {
    next(err);
  }
};

// ─── Settings ───────────────────────────────────────────────
export const getSettings = async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const settings = await SiteSetting.find();
    sendResponse(res, 200, settings);
  } catch (err) {
    next(err);
  }
};

export const updateSetting = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { key } = req.params;
    const { value } = req.body;

    const setting = await SiteSetting.findOneAndUpdate(
      { key },
      { value },
      { new: true, upsert: true }
    );

    sendResponse(res, 200, setting, "Setting updated");
  } catch (err) {
    next(err);
  }
};

// ─── Slider Images ──────────────────────────────────────────
export const getSliderImages = async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const images = await SliderImage.find().sort({ sortOrder: 1 });
    sendResponse(res, 200, images);
  } catch (err) {
    next(err);
  }
};

export const createSliderImage = async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (req.file) {
      req.body.imageUrl = `/uploads/slider/${req.file.filename}`;
    }

    if (typeof req.body.isActive === "string") {
      req.body.isActive = req.body.isActive === "true";
    }
    if (typeof req.body.sortOrder === "string") {
      req.body.sortOrder = parseInt(req.body.sortOrder) || 0;
    }

    const image = await SliderImage.create(req.body);
    clearContentCache();
    sendResponse(res, 201, image, "Slider image created");
  } catch (err) {
    next(err);
  }
};

export const bulkCreateSliderImages = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const files = req.files as Express.Multer.File[];
    if (!files || files.length === 0) {
      throw new AppError("No images uploaded", 400);
    }

    const currentMax = await SliderImage.findOne().sort({ sortOrder: -1 }).select("sortOrder");
    let sortOrder = (currentMax?.sortOrder || 0) + 1;

    const sliderType = (req.body.sliderType as string) || "general";

    const created = [];
    for (const file of files) {
      const imageUrl = `/uploads/slider/${file.filename}`;
      const title = file.originalname.replace(/\.[^.]+$/, "").replace(/[-_]/g, " ");
      const image = await SliderImage.create({ title, imageUrl, sortOrder, sliderType, isActive: true });
      created.push(image);
      sortOrder++;
    }

    clearContentCache();
    sendResponse(res, 201, created, `${created.length} slider images uploaded`);
  } catch (err) {
    next(err);
  }
};

export const updateSliderImage = async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (typeof req.body.isActive === "string") {
      req.body.isActive = req.body.isActive === "true";
    }
    const image = await SliderImage.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true,
    });
    if (!image) throw new AppError("Slider image not found", 404);
    clearContentCache();
    sendResponse(res, 200, image, "Slider image updated");
  } catch (err) {
    next(err);
  }
};

export const deleteSliderImage = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const image = await SliderImage.findById(req.params.id);
    if (!image) throw new AppError("Slider image not found", 404);

    // Delete local file
    removeSliderFile(image.imageUrl);

    await SliderImage.findByIdAndDelete(req.params.id);
    clearContentCache();
    sendResponse(res, 200, null, "Slider image deleted");
  } catch (err) {
    next(err);
  }
};

// ─── Testimonials ───────────────────────────────────────────
export const getTestimonials = async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const testimonials = await Testimonial.find().sort({ sortOrder: 1 });
    sendResponse(res, 200, testimonials);
  } catch (err) {
    next(err);
  }
};

export const createTestimonial = async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (typeof req.body.isActive === "string") {
      req.body.isActive = req.body.isActive === "true";
    }
    if (typeof req.body.sortOrder === "string") {
      req.body.sortOrder = parseInt(req.body.sortOrder) || 0;
    }
    if (typeof req.body.rating === "string") {
      req.body.rating = parseInt(req.body.rating) || 5;
    }

    const testimonial = await Testimonial.create(req.body);
    clearContentCache();
    sendResponse(res, 201, testimonial, "Testimonial created");
  } catch (err) {
    next(err);
  }
};

export const updateTestimonial = async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (typeof req.body.isActive === "string") {
      req.body.isActive = req.body.isActive === "true";
    }
    if (typeof req.body.rating === "string") {
      req.body.rating = parseInt(req.body.rating) || 5;
    }
    const testimonial = await Testimonial.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true,
    });
    if (!testimonial) throw new AppError("Testimonial not found", 404);
    clearContentCache();
    sendResponse(res, 200, testimonial, "Testimonial updated");
  } catch (err) {
    next(err);
  }
};

export const deleteTestimonial = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const testimonial = await Testimonial.findByIdAndDelete(req.params.id);
    if (!testimonial) throw new AppError("Testimonial not found", 404);
    clearContentCache();
    sendResponse(res, 200, null, "Testimonial deleted");
  } catch (err) {
    next(err);
  }
};

// ─── Sub-Categories ─────────────────────────────────────────
export const getSubCategories = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const filter: Record<string, unknown> = {};
    if (req.query.category) filter.category = req.query.category;
    const subs = await SubCategory.find(filter)
      .populate("category", "name slug")
      .sort({ sortOrder: 1 });
    sendResponse(res, 200, subs);
  } catch (err) {
    next(err);
  }
};

export const createSubCategory = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const files = req.files as { [field: string]: Express.Multer.File[] } | undefined;

    let existingPreviews: string[] = [];
    if (typeof req.body.previewImages === "string") {
      existingPreviews = JSON.parse(req.body.previewImages);
    }
    const uploadedPreviews = (files?.previewFiles || []).map(
      (f) => `/uploads/subcategories/${f.filename}`
    );
    req.body.previewImages = [...existingPreviews, ...uploadedPreviews];

    if (typeof req.body.sortOrder === "string") req.body.sortOrder = parseInt(req.body.sortOrder) || 0;

    const sub = await SubCategory.create(req.body);
    // Update parent category subcategory count
    await Category.findByIdAndUpdate(req.body.category, {
      $set: { assetCount: await SubCategory.countDocuments({ category: req.body.category }) },
    });
    clearContentCache();
    sendResponse(res, 201, sub, "Sub-category created");
  } catch (err) {
    next(err);
  }
};

export const updateSubCategory = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const files = req.files as { [field: string]: Express.Multer.File[] } | undefined;
    const existing = await SubCategory.findById(req.params.id).select("previewImages category");

    let keptPreviews: string[] = [];
    if (typeof req.body.previewImages === "string") {
      keptPreviews = JSON.parse(req.body.previewImages);
    }
    const uploadedPreviews = (files?.previewFiles || []).map(
      (f) => `/uploads/subcategories/${f.filename}`
    );
    req.body.previewImages = [...keptPreviews, ...uploadedPreviews];

    // Clean up removed preview images
    if (existing?.previewImages) {
      for (const oldImg of existing.previewImages) {
        if (!keptPreviews.includes(oldImg)) {
          removeSubCategoryFile(oldImg);
        }
      }
    }

    if (typeof req.body.sortOrder === "string") req.body.sortOrder = parseInt(req.body.sortOrder) || 0;

    const sub = await SubCategory.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true,
    });
    if (!sub) throw new AppError("Sub-category not found", 404);
    clearContentCache();
    sendResponse(res, 200, sub, "Sub-category updated");
  } catch (err) {
    next(err);
  }
};

export const deleteSubCategory = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const sub = await SubCategory.findById(req.params.id);
    if (!sub) throw new AppError("Sub-category not found", 404);
    // Clean up preview images
    for (const img of sub.previewImages || []) {
      removeSubCategoryFile(img);
    }
    await SubCategory.findByIdAndDelete(req.params.id);
    // Update parent category count
    await Category.findByIdAndUpdate(sub.category, {
      $set: { assetCount: await SubCategory.countDocuments({ category: sub.category }) },
    });
    clearContentCache();
    sendResponse(res, 200, null, "Sub-category deleted");
  } catch (err) {
    next(err);
  }
};

// ─── Contacts ──────────────────────────────────────────────
export const getContacts = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.min(50, parseInt(req.query.limit as string) || 20);
    const skip = (page - 1) * limit;

    const filter: Record<string, unknown> = {};
    if (req.query.read === "true") filter.read = true;
    if (req.query.read === "false") filter.read = false;

    const [contacts, total] = await Promise.all([
      Contact.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit),
      Contact.countDocuments(filter),
    ]);
    sendPaginated(res, contacts, total, page, limit);
  } catch (err) {
    next(err);
  }
};

export const updateContact = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const contact = await Contact.findByIdAndUpdate(
      req.params.id,
      { read: req.body.read },
      { new: true, runValidators: true }
    );
    if (!contact) throw new AppError("Contact not found", 404);
    sendResponse(res, 200, contact, "Contact updated");
  } catch (err) {
    next(err);
  }
};

export const deleteContact = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const contact = await Contact.findByIdAndDelete(req.params.id);
    if (!contact) throw new AppError("Contact not found", 404);
    sendResponse(res, 200, null, "Contact deleted");
  } catch (err) {
    next(err);
  }
};
