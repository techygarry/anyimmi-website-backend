import { Request, Response, NextFunction } from "express";
import { AppError } from "../utils/apiError.js";

export const aiRateLimiter = (
  req: Request,
  _res: Response,
  next: NextFunction
) => {
  if (!req.user) {
    return next(new AppError("Not authenticated", 401));
  }

  if (
    req.user.plan === "free" &&
    req.user.aiGenerationsThisMonth >= 5
  ) {
    return next(
      new AppError(
        "Free plan limit reached (5 AI generations/month). Upgrade to Pro for unlimited access.",
        429
      )
    );
  }

  next();
};
