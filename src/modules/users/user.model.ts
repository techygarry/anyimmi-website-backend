import mongoose, { Document, Schema, Types } from "mongoose";

export interface IUser extends Document {
  _id: Types.ObjectId;
  name: string;
  email: string;
  password?: string;
  avatar?: string;
  firmName?: string;
  phone?: string;
  role: "user" | "admin";
  plan: "free" | "pro" | "business";
  stripeCustomerId?: string;
  subscriptionId?: string;
  subscriptionStatus?: string;
  portalProExpiresAt?: Date;
  googleId?: string;
  isEmailVerified: boolean;
  emailVerificationToken?: string;
  passwordResetToken?: string;
  passwordResetExpires?: Date;
  favorites: Types.ObjectId[];
  aiGenerationsThisMonth: number;
  createdAt: Date;
  updatedAt: Date;
}

const userSchema = new Schema<IUser>(
  {
    name: { type: String, required: true, trim: true },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    password: { type: String, select: false },
    avatar: { type: String },
    firmName: { type: String },
    phone: { type: String },
    role: { type: String, enum: ["user", "admin"], default: "user" },
    plan: { type: String, enum: ["free", "pro", "business"], default: "free" },
    stripeCustomerId: { type: String },
    subscriptionId: { type: String },
    subscriptionStatus: { type: String },
    portalProExpiresAt: { type: Date },
    googleId: { type: String, sparse: true },
    isEmailVerified: { type: Boolean, default: false },
    emailVerificationToken: { type: String },
    passwordResetToken: { type: String },
    passwordResetExpires: { type: Date },
    favorites: [{ type: Schema.Types.ObjectId, ref: "Asset" }],
    aiGenerationsThisMonth: { type: Number, default: 0 },
  },
  { timestamps: true }
);

export const User = mongoose.model<IUser>("User", userSchema);
