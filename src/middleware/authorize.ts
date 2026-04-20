import { Request, Response, NextFunction } from "express";
import { AppError } from "../utils/apiError.js";

export const authorize = (...roles: string[]) => {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return next(new AppError("Not authorized to access this resource", 403));
    }
    next();
  };
};
