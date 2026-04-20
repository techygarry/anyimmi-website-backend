import { Request, Response, NextFunction } from "express";
import { Asset } from "./asset.model.js";
import { Category } from "./category.model.js";
import { Download } from "./download.model.js";
import { AppError } from "../../utils/apiError.js";
import { sendResponse, sendPaginated } from "../../utils/apiResponse.js";
import { GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { s3Client } from "../../config/spaces.js";
import { env } from "../../config/env.js";
import { contentCache } from "../../utils/cache.js";

export const listAssets = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const { category, fileFormat, programType, search } = req.query;

    const filter: Record<string, unknown> = {};

    // Free users without a bundle purchase can only see free assets
    // Bundle purchasers (have portalProExpiresAt) get lifetime asset access
    if (req.user!.plan === "free" && !req.user!.portalProExpiresAt) {
      filter.isFree = true;
    }

    if (category) filter.category = category;
    if (fileFormat) filter.fileFormat = fileFormat;
    if (programType) filter.programType = programType;
    if (search) {
      const escaped = (search as string).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      filter.$or = [
        { name: { $regex: escaped, $options: "i" } },
        { description: { $regex: escaped, $options: "i" } },
        { tags: { $regex: escaped, $options: "i" } },
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

export const getAsset = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const asset = await Asset.findByIdAndUpdate(
      req.params.id,
      { $inc: { viewCount: 1 } },
      { new: true }
    ).populate("category", "name slug");

    if (!asset) {
      throw new AppError("Asset not found", 404);
    }

    sendResponse(res, 200, asset);
  } catch (err) {
    next(err);
  }
};

/** Convert a Google Drive share link to a direct download URL */
function toDriveDirectUrl(driveUrl: string): string {
  // Handle formats: /file/d/FILE_ID/... or ?id=FILE_ID
  const match = driveUrl.match(/\/file\/d\/([^/]+)/) || driveUrl.match(/[?&]id=([^&]+)/);
  if (match) {
    return `https://drive.google.com/uc?export=download&id=${match[1]}`;
  }
  return driveUrl; // already a direct link or unknown format
}

export const downloadAsset = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const asset = await Asset.findById(req.params.id);
    if (!asset) {
      throw new AppError("Asset not found", 404);
    }

    // Free users without a bundle purchase can only download free assets
    if (req.user!.plan === "free" && !asset.isFree && !req.user!.portalProExpiresAt) {
      throw new AppError("Upgrade to Pro to download this asset", 403);
    }

    let url: string;

    if (asset.sourceType === "drive" && asset.driveUrl) {
      // Google Drive link — convert to direct download URL
      url = toDriveDirectUrl(asset.driveUrl);
    } else {
      // S3/Spaces — generate presigned URL
      const key = asset.fileUrl.replace(
        `${env.DO_SPACES_ENDPOINT}/${env.DO_SPACES_BUCKET}/`,
        ""
      );

      const filename = `${asset.name}.${asset.fileFormat}`;
      const command = new GetObjectCommand({
        Bucket: env.DO_SPACES_BUCKET,
        Key: key,
        ResponseContentDisposition: `attachment; filename="${filename}"`,
      });

      url = await getSignedUrl(s3Client, command, { expiresIn: 300 });
    }

    // Track download
    await Download.create({
      userId: req.user!._id,
      assetId: asset._id,
    });

    await Asset.findByIdAndUpdate(asset._id, {
      $inc: { downloadCount: 1 },
    });

    sendResponse(res, 200, { url, sourceType: asset.sourceType }, "Download URL generated");
  } catch (err) {
    next(err);
  }
};

export const bulkDownload = async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (req.user!.plan === "free" && !req.user!.portalProExpiresAt) {
      throw new AppError("Upgrade to Pro for bulk downloads", 403);
    }

    const { assetIds } = req.body;
    if (!assetIds || !Array.isArray(assetIds) || assetIds.length === 0) {
      throw new AppError("No assets selected", 400);
    }

    const assets = await Asset.find({ _id: { $in: assetIds } });
    const urls = await Promise.all(
      assets.map(async (asset) => {
        let url: string;

        if (asset.sourceType === "drive" && asset.driveUrl) {
          url = toDriveDirectUrl(asset.driveUrl);
        } else {
          const key = asset.fileUrl.replace(
            `${env.DO_SPACES_ENDPOINT}/${env.DO_SPACES_BUCKET}/`,
            ""
          );
          const command = new GetObjectCommand({
            Bucket: env.DO_SPACES_BUCKET,
            Key: key,
          });
          url = await getSignedUrl(s3Client, command, { expiresIn: 300 });
        }

        await Download.create({
          userId: req.user!._id,
          assetId: asset._id,
        });

        return { id: asset._id, name: asset.name, url, sourceType: asset.sourceType };
      })
    );

    sendResponse(res, 200, { urls });
  } catch (err) {
    next(err);
  }
};

export const listCategories = async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const key = "categories";
    const cached = contentCache.get(key);
    if (cached) {
      res.set("Cache-Control", "public, max-age=300, s-maxage=300");
      return sendResponse(res, 200, cached);
    }
    const categories = await Category.find().sort({ sortOrder: 1 });
    contentCache.set(key, categories);
    res.set("Cache-Control", "public, max-age=300, s-maxage=300");
    sendResponse(res, 200, categories);
  } catch (err) {
    next(err);
  }
};

export const getCategoryBySlug = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const slug = req.params.slug as string;
    const key = `category:${slug}`;
    const cached = contentCache.get(key);
    if (cached) {
      res.set("Cache-Control", "public, max-age=300, s-maxage=300");
      return sendResponse(res, 200, cached);
    }
    const category = await Category.findOne({ slug });
    if (!category) {
      throw new AppError("Category not found", 404);
    }
    contentCache.set(key, category);
    res.set("Cache-Control", "public, max-age=300, s-maxage=300");
    sendResponse(res, 200, category);
  } catch (err) {
    next(err);
  }
};
