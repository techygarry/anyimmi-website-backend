import { Request, Response, NextFunction } from "express";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import { env } from "../../config/env.js";
import { sendResponse } from "../../utils/apiResponse.js";
import {
  registerUser,
  loginUser,
  generateAccessToken,
  generateRefreshToken,
  verifyEmail as verifyEmailService,
  forgotPassword as forgotPasswordService,
  resetPassword as resetPasswordService,
} from "./auth.service.js";
import jwt from "jsonwebtoken";
import { AppError } from "../../utils/apiError.js";
import { sendVerificationEmail, sendPasswordResetEmail } from "../email/email.service.js";
import { stripe } from "../../config/stripe.js";
import { User } from "../users/user.model.js";
import { logger } from "../../utils/logger.js";

const COOKIE_OPTIONS = {
  httpOnly: true,
  secure: env.NODE_ENV === "production",
  sameSite: "lax" as const,
  path: "/",
};

export const register = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { name, email, password } = req.body;
    const { user, verificationToken } = await registerUser(
      name,
      email,
      password
    );

    // Send verification email
    await sendVerificationEmail(email, verificationToken);
    if (env.NODE_ENV === "development") {
      console.log(`Verification token for ${email}: ${verificationToken}`);
    }

    sendResponse(res, 201, {
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
      },
    }, "Registration successful. Please verify your email.");
  } catch (err) {
    next(err);
  }
};

export const login = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { email, password } = req.body;
    const user = await loginUser(email, password);

    const accessToken = generateAccessToken(user._id.toString());
    const refreshToken = generateRefreshToken(user._id.toString());

    res.cookie("accessToken", accessToken, {
      ...COOKIE_OPTIONS,
      maxAge: 15 * 60 * 1000, // 15 min
    });

    res.cookie("refreshToken", refreshToken, {
      ...COOKIE_OPTIONS,
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    });

    sendResponse(res, 200, {
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        plan: user.plan,
        avatar: user.avatar,
        firmName: user.firmName,
        isEmailVerified: user.isEmailVerified,
      },
    }, "Login successful");
  } catch (err) {
    next(err);
  }
};

export const refresh = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const token = req.cookies?.refreshToken;
    if (!token) {
      throw new AppError("No refresh token", 401);
    }

    const decoded = jwt.verify(token, env.JWT_REFRESH_SECRET) as {
      userId: string;
    };
    const accessToken = generateAccessToken(decoded.userId);

    res.cookie("accessToken", accessToken, {
      ...COOKIE_OPTIONS,
      maxAge: 15 * 60 * 1000,
    });

    sendResponse(res, 200, null, "Token refreshed");
  } catch (err) {
    next(new AppError("Invalid refresh token", 401));
  }
};

export const logout = async (
  _req: Request,
  res: Response,
  _next: NextFunction
) => {
  res.clearCookie("accessToken", COOKIE_OPTIONS);
  res.clearCookie("refreshToken", COOKIE_OPTIONS);
  sendResponse(res, 200, null, "Logged out successfully");
};

export const verifyEmailHandler = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const token = req.params.token as string;
    await verifyEmailService(token);
    sendResponse(res, 200, null, "Email verified successfully");
  } catch (err) {
    next(err);
  }
};

export const forgotPasswordHandler = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { email } = req.body;
    const result = await forgotPasswordService(email);

    // Always return success (don't reveal if email exists)
    if (result) {
      await sendPasswordResetEmail(email, result.resetToken);
      if (env.NODE_ENV === "development") {
        console.log(`Reset token for ${email}: ${result.resetToken}`);
      }
    }

    sendResponse(
      res,
      200,
      null,
      "If that email exists, a password reset link has been sent."
    );
  } catch (err) {
    next(err);
  }
};

export const resetPasswordHandler = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { token, password } = req.body;
    await resetPasswordService(token, password);
    sendResponse(res, 200, null, "Password reset successful. Please login.");
  } catch (err) {
    next(err);
  }
};

const TIER_PRO_MONTHS: Record<string, number> = {
  starter: 3,
  custom: 6,
  ultimate: 12,
};

export const claimPurchase = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { sessionId } = req.body;
    if (!sessionId) {
      throw new AppError("Session ID is required", 400);
    }

    // Retrieve Stripe session to verify payment
    const session = await stripe.checkout.sessions.retrieve(sessionId);
    if (session.payment_status !== "paid") {
      throw new AppError("Payment not completed", 400);
    }

    const email =
      session.customer_details?.email || session.customer_email;
    if (!email) {
      throw new AppError("No email found in session", 400);
    }

    const tier = session.metadata?.tier;

    // Find or create user (idempotent — webhook may have already created)
    let user = await User.findOne({ email });
    if (!user) {
      const proMonths = TIER_PRO_MONTHS[tier || "starter"] || 3;
      const portalProExpiresAt = new Date();
      portalProExpiresAt.setMonth(portalProExpiresAt.getMonth() + proMonths);

      user = await User.create({
        name: session.customer_details?.name || "Bundle Buyer",
        email,
        isEmailVerified: true,
        plan: "pro",
        portalProExpiresAt,
      });
      logger.info(`User created via claim-purchase: ${email}`);
    }

    // Generate tokens and set cookies (auto-login)
    const accessToken = generateAccessToken(user._id.toString());
    const refreshToken = generateRefreshToken(user._id.toString());

    res.cookie("accessToken", accessToken, {
      ...COOKIE_OPTIONS,
      maxAge: 15 * 60 * 1000,
    });

    res.cookie("refreshToken", refreshToken, {
      ...COOKIE_OPTIONS,
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    sendResponse(
      res,
      200,
      {
        user: {
          id: user._id,
          name: user.name,
          email: user.email,
          role: user.role,
          plan: user.plan,
          avatar: user.avatar,
          firmName: user.firmName,
          isEmailVerified: user.isEmailVerified,
        },
      },
      "Account claimed successfully"
    );
  } catch (err) {
    next(err);
  }
};

/**
 * Dev-only login for the unified dashboard. Creates the user if missing
 * and issues JWT cookies without going through magic-link / password flow.
 * Disabled when NODE_ENV === "production".
 */
export const devLogin = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    if (env.NODE_ENV === "production") {
      throw new AppError("Dev login disabled in production", 403);
    }

    const email =
      typeof req.body?.email === "string"
        ? req.body.email.trim().toLowerCase()
        : "";
    if (!email) {
      throw new AppError("Email is required", 400);
    }

    let user = await User.findOne({ email });
    if (!user) {
      const randomPassword = crypto.randomBytes(24).toString("hex");
      const hashedPassword = await bcrypt.hash(randomPassword, 12);
      const derivedName = email.split("@")[0] || "Dev User";
      user = await User.create({
        name: derivedName,
        email,
        password: hashedPassword,
        isEmailVerified: true,
      });
      logger.info(`Dev login created user: ${email}`);
    }

    const accessToken = generateAccessToken(user._id.toString());
    const refreshToken = generateRefreshToken(user._id.toString());

    res.cookie("accessToken", accessToken, {
      ...COOKIE_OPTIONS,
      maxAge: 15 * 60 * 1000,
    });
    res.cookie("refreshToken", refreshToken, {
      ...COOKIE_OPTIONS,
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    sendResponse(
      res,
      200,
      {
        user: {
          id: user._id,
          name: user.name,
          email: user.email,
          role: user.role || "owner",
        },
        token: accessToken,
      },
      "Dev login successful"
    );
  } catch (err) {
    next(err);
  }
};
