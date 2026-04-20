import mongoose, { Document, Schema, Types } from "mongoose";

export interface IOrder extends Document {
  _id: Types.ObjectId;
  userId?: Types.ObjectId;
  email: string;
  name?: string;
  invoiceNumber?: string;
  stripeSessionId: string;
  stripePaymentIntent?: string;
  stripeCustomerId?: string;
  tier: string;
  amount: number;
  currency: string;
  status: "pending" | "completed" | "refunded";
  deliveryStatus:
    | "pending"
    | "email_sent"
    | "intake_sent"
    | "branding_delivered"
    | "website_delivered";
  portalAccessGranted: boolean;
  portalProMonths: number;
  metadata?: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

const orderSchema = new Schema<IOrder>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User" },
    email: { type: String, required: true },
    name: { type: String },
    invoiceNumber: { type: String, unique: true, sparse: true },
    stripeSessionId: { type: String, unique: true, required: true },
    stripePaymentIntent: { type: String },
    stripeCustomerId: { type: String },
    tier: { type: String, required: true },
    amount: { type: Number, required: true },
    currency: { type: String, default: "usd" },
    status: {
      type: String,
      enum: ["pending", "completed", "refunded"],
      default: "pending",
    },
    deliveryStatus: {
      type: String,
      enum: [
        "pending",
        "email_sent",
        "intake_sent",
        "branding_delivered",
        "website_delivered",
      ],
      default: "pending",
    },
    portalAccessGranted: { type: Boolean, default: false },
    portalProMonths: { type: Number, default: 0 },
    metadata: { type: Schema.Types.Mixed },
  },
  { timestamps: true }
);

orderSchema.index({ email: 1 });
orderSchema.index({ createdAt: -1 });

export const Order = mongoose.model<IOrder>("Order", orderSchema);
