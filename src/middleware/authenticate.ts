import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { env } from "../config/env.js";
import { User } from "../modules/users/user.model.js";
import { AppError } from "../utils/apiError.js";

interface JwtPayload {
  userId: string;
}

export const authenticate = async (
  req: Request,
  _res: Response,
  next: NextFunction
) => {
  try {
    const token = req.cookies?.accessToken;
    if (!token) {
      throw new AppError("Not authenticated", 401);
    }

    const decoded = jwt.verify(token, env.JWT_SECRET) as JwtPayload;
    const user = await User.findById(decoded.userId);

    if (!user) {
      throw new AppError("User not found", 401);
    }

    // Check if portal Pro access has expired
    if (
      user.portalProExpiresAt &&
      user.portalProExpiresAt < new Date() &&
      user.plan === "pro" &&
      !user.subscriptionId
    ) {
      user.plan = "free";
      await user.save();
    }

    req.user = user;
    next();
  } catch (err) {
    if (err instanceof AppError) {
      next(err);
    } else {
      next(new AppError("Invalid or expired token", 401));
    }
  }
};
