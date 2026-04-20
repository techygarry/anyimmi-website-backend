import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import crypto from "crypto";
import { env } from "../../config/env.js";
import { User, IUser } from "../users/user.model.js";
import { AppError } from "../../utils/apiError.js";

export const generateAccessToken = (userId: string): string => {
  return jwt.sign({ userId }, env.JWT_SECRET, { expiresIn: "15m" });
};

export const generateRefreshToken = (userId: string): string => {
  return jwt.sign({ userId }, env.JWT_REFRESH_SECRET, { expiresIn: "7d" });
};

export const generateVerificationToken = (): string => {
  return crypto.randomBytes(32).toString("hex");
};

export const generateResetToken = (): { token: string; hashed: string } => {
  const token = crypto.randomBytes(32).toString("hex");
  const hashed = crypto.createHash("sha256").update(token).digest("hex");
  return { token, hashed };
};

export const registerUser = async (
  name: string,
  email: string,
  password: string
): Promise<{ user: IUser; verificationToken: string }> => {
  const existing = await User.findOne({ email });
  if (existing) {
    throw new AppError("Email already registered", 409);
  }

  const hashedPassword = await bcrypt.hash(password, 12);
  const verificationToken = generateVerificationToken();

  const user = await User.create({
    name,
    email,
    password: hashedPassword,
    emailVerificationToken: verificationToken,
  });

  return { user, verificationToken };
};

export const loginUser = async (
  email: string,
  password: string
): Promise<IUser> => {
  const user = await User.findOne({ email }).select("+password");
  if (!user || !user.password) {
    throw new AppError("Invalid email or password", 401);
  }

  const isMatch = await bcrypt.compare(password, user.password);
  if (!isMatch) {
    throw new AppError("Invalid email or password", 401);
  }

  return user;
};

export const verifyEmail = async (token: string): Promise<IUser> => {
  const user = await User.findOne({ emailVerificationToken: token });
  if (!user) {
    throw new AppError("Invalid verification token", 400);
  }

  user.isEmailVerified = true;
  user.emailVerificationToken = undefined;
  await user.save();

  return user;
};

export const forgotPassword = async (
  email: string
): Promise<{ user: IUser; resetToken: string } | null> => {
  const user = await User.findOne({ email });
  if (!user) {
    return null; // Don't reveal if email exists
  }

  const { token, hashed } = generateResetToken();
  user.passwordResetToken = hashed;
  user.passwordResetExpires = new Date(Date.now() + 60 * 60 * 1000); // 1 hour
  await user.save();

  return { user, resetToken: token };
};

export const resetPassword = async (
  token: string,
  newPassword: string
): Promise<IUser> => {
  const hashed = crypto.createHash("sha256").update(token).digest("hex");

  const user = await User.findOne({
    passwordResetToken: hashed,
    passwordResetExpires: { $gt: new Date() },
  });

  if (!user) {
    throw new AppError("Invalid or expired reset token", 400);
  }

  user.password = await bcrypt.hash(newPassword, 12);
  user.passwordResetToken = undefined;
  user.passwordResetExpires = undefined;
  await user.save();

  return user;
};
