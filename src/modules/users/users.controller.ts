import { Request, Response, NextFunction } from "express";
import bcrypt from "bcryptjs";
import { Types } from "mongoose";
import { User } from "./user.model.js";
import { Entitlement } from "./entitlement.model.js";
import { Download } from "../assets/download.model.js";
import { AppError } from "../../utils/apiError.js";
import { sendResponse, sendPaginated } from "../../utils/apiResponse.js";
import { PutObjectCommand } from "@aws-sdk/client-s3";
import { s3Client } from "../../config/spaces.js";
import { env } from "../../config/env.js";

const findActiveEntitlements = (userId: Types.ObjectId) =>
  Entitlement.find({
    userId,
    status: "active",
    $or: [
      { expiresAt: { $exists: false } },
      { expiresAt: { $gt: new Date() } },
    ],
  });

export const getMe = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = req.user;
    if (!user) {
      throw new AppError("Not authenticated", 401);
    }

    const entitlements = await findActiveEntitlements(user._id);

    sendResponse(res, 200, {
      user: {
        id: user._id,
        email: user.email,
        name: user.name,
        role: user.role || "owner",
      },
      org: {
        id: user._id,
        type: "solo",
        name: `${user.name}'s workspace`,
      },
      entitlements: entitlements.map((e) => ({
        product: e.product,
        tier: e.tier,
        status: e.status,
        expiresAt: e.expiresAt,
        source: e.source,
      })),
    });
  } catch (err) {
    next(err);
  }
};

export const getMyEntitlements = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const user = req.user;
    if (!user) {
      throw new AppError("Not authenticated", 401);
    }

    const entitlements = await findActiveEntitlements(user._id);

    sendResponse(
      res,
      200,
      entitlements.map((e) => ({
        product: e.product,
        tier: e.tier,
        status: e.status,
        expiresAt: e.expiresAt,
        source: e.source,
      }))
    );
  } catch (err) {
    next(err);
  }
};

export const updateProfile = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { name, firmName, phone } = req.body;
    const user = await User.findByIdAndUpdate(
      req.user!._id,
      { name, firmName, phone },
      { new: true, runValidators: true }
    );
    sendResponse(res, 200, user, "Profile updated");
  } catch (err) {
    next(err);
  }
};

export const uploadAvatar = async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.file) {
      throw new AppError("No file uploaded", 400);
    }

    const key = `avatars/${req.user!._id}-${Date.now()}.${req.file.originalname.split(".").pop()}`;

    await s3Client.send(
      new PutObjectCommand({
        Bucket: env.DO_SPACES_BUCKET,
        Key: key,
        Body: req.file.buffer,
        ContentType: req.file.mimetype,
        ACL: "public-read",
      })
    );

    const avatarUrl = `${env.DO_SPACES_ENDPOINT}/${env.DO_SPACES_BUCKET}/${key}`;
    const user = await User.findByIdAndUpdate(
      req.user!._id,
      { avatar: avatarUrl },
      { new: true }
    );

    sendResponse(res, 200, { avatar: user?.avatar }, "Avatar updated");
  } catch (err) {
    next(err);
  }
};

export const changePassword = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { currentPassword, newPassword } = req.body;
    const user = await User.findById(req.user!._id).select("+password");

    if (!user || !user.password) {
      throw new AppError("Cannot change password for OAuth-only accounts", 400);
    }

    const isMatch = await bcrypt.compare(currentPassword, user.password);
    if (!isMatch) {
      throw new AppError("Current password is incorrect", 401);
    }

    user.password = await bcrypt.hash(newPassword, 12);
    await user.save();

    sendResponse(res, 200, null, "Password changed successfully");
  } catch (err) {
    next(err);
  }
};

export const getFavorites = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;

    const user = await User.findById(req.user!._id).populate({
      path: "favorites",
      options: { skip: (page - 1) * limit, limit },
    });

    const total = req.user!.favorites.length;
    sendPaginated(res, user?.favorites || [], total, page, limit);
  } catch (err) {
    next(err);
  }
};

export const addFavorite = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { assetId } = req.params;
    await User.findByIdAndUpdate(req.user!._id, {
      $addToSet: { favorites: assetId },
    });
    sendResponse(res, 200, null, "Added to favorites");
  } catch (err) {
    next(err);
  }
};

export const removeFavorite = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { assetId } = req.params;
    await User.findByIdAndUpdate(req.user!._id, {
      $pull: { favorites: assetId },
    });
    sendResponse(res, 200, null, "Removed from favorites");
  } catch (err) {
    next(err);
  }
};

export const getDownloads = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;

    const [downloads, total] = await Promise.all([
      Download.find({ userId: req.user!._id })
        .populate("assetId", "name fileFormat previewUrl category")
        .sort({ downloadedAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit),
      Download.countDocuments({ userId: req.user!._id }),
    ]);

    sendPaginated(res, downloads, total, page, limit);
  } catch (err) {
    next(err);
  }
};

export const getStats = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const [totalDownloads, user] = await Promise.all([
      Download.countDocuments({ userId: req.user!._id }),
      User.findById(req.user!._id),
    ]);

    sendResponse(res, 200, {
      totalDownloads,
      favoritesCount: user?.favorites.length || 0,
      aiGenerationsThisMonth: user?.aiGenerationsThisMonth || 0,
      plan: user?.plan,
    });
  } catch (err) {
    next(err);
  }
};
