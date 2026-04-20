import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { Types } from "mongoose";
import { env } from "../config/env.js";
import { User } from "../modules/users/user.model.js";
import { db } from "../db/client.js";
import { users as pgUsers } from "../db/schema/index.js";
import { eq } from "drizzle-orm";
import { AppError } from "../utils/apiError.js";

interface JwtPayload {
  userId: string;
}

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const OBJECT_ID_RE = /^[0-9a-f]{24}$/i;

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
    const rawId = decoded.userId;

    // Prefer Postgres: new JWTs after migration carry a UUID.
    if (rawId && UUID_RE.test(rawId)) {
      const [pgUser] = await db
        .select()
        .from(pgUsers)
        .where(eq(pgUsers.id, rawId))
        .limit(1);
      if (!pgUser) {
        throw new AppError("Unauthorized", 401);
      }
      attachPgUserToReq(req, pgUser);
      return next();
    }

    // Legacy JWT: Mongo ObjectId. Try Postgres via legacyMongoId bridge first,
    // then fall back to Mongoose for routes still on Mongo.
    if (rawId && OBJECT_ID_RE.test(rawId)) {
      const [pgUser] = await db
        .select()
        .from(pgUsers)
        .where(eq(pgUsers.legacyMongoId, rawId))
        .limit(1);
      if (pgUser) {
        attachPgUserToReq(req, pgUser);
        return next();
      }
    }

    // Fallback: Mongo-only user (admin routes still rely on this).
    const user = await User.findById(rawId);
    if (!user) {
      throw new AppError("User not found", 401);
    }

    // Check if portal Pro access has expired (legacy Mongo flow).
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

/**
 * Build a Mongo-shaped req.user from a Postgres row so downstream code
 * that reads `req.user._id`, `req.user.email`, etc. keeps working.
 * The `_id` field is the Postgres UUID string; downstream Postgres lookups
 * should use this directly.
 */
function attachPgUserToReq(
  req: Request,
  pgUser: {
    id: string;
    email: string;
    name: string | null;
    role: string;
  }
) {
  // Cast to the IUser shape. This is intentionally loose — the fields
  // actually read downstream (_id, email, name, role) are populated.
  req.user = {
    _id: pgUser.id as unknown as Types.ObjectId,
    email: pgUser.email,
    name: pgUser.name || pgUser.email.split("@")[0],
    role: (pgUser.role === "super_admin" ? "admin" : "user") as "user" | "admin",
    plan: "free",
    isEmailVerified: true,
    favorites: [],
    aiGenerationsThisMonth: 0,
    createdAt: new Date(),
    updatedAt: new Date(),
  } as unknown as import("../modules/users/user.model.js").IUser;
}
