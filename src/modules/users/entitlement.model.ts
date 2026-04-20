import mongoose, { Document, Schema, Types } from "mongoose";

export type EntitlementProduct = "ai-tools" | "crm" | "dossiar" | "portal-pro";
export type EntitlementSource =
  | "bundle-founder"
  | "subscription"
  | "trial"
  | "manual";
export type EntitlementStatus = "active" | "expired" | "cancelled";

export interface IEntitlement extends Document {
  _id: Types.ObjectId;
  userId: Types.ObjectId;
  product: EntitlementProduct;
  tier: string;
  status: EntitlementStatus;
  expiresAt: Date;
  source: EntitlementSource;
  createdAt: Date;
  updatedAt: Date;
}

const entitlementSchema = new Schema<IEntitlement>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    product: {
      type: String,
      enum: ["ai-tools", "crm", "dossiar", "portal-pro"],
      required: true,
    },
    tier: { type: String, required: true, default: "pro" },
    status: {
      type: String,
      enum: ["active", "expired", "cancelled"],
      default: "active",
    },
    expiresAt: { type: Date, required: true },
    source: {
      type: String,
      enum: ["bundle-founder", "subscription", "trial", "manual"],
      required: true,
    },
  },
  { timestamps: true }
);

entitlementSchema.index({ userId: 1, product: 1 }, { unique: true });

export const Entitlement = mongoose.model<IEntitlement>(
  "Entitlement",
  entitlementSchema
);

const FOUNDER_TRIAL_PRODUCTS: EntitlementProduct[] = [
  "ai-tools",
  "crm",
  "dossiar",
];

/**
 * Grant (or extend) 90-day trial entitlements for the three upcoming
 * products when a user buys the FOUNDER bundle.
 *
 * If an entitlement row already exists for (userId, product), extend its
 * expiresAt by 90 days from now (whichever is later) and reactivate.
 */
export async function grantFounderTrialEntitlements(
  userId: Types.ObjectId | string
): Promise<void> {
  const now = new Date();
  const expiresAt = new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000);

  await Promise.all(
    FOUNDER_TRIAL_PRODUCTS.map(async (product) => {
      const existing = await Entitlement.findOne({ userId, product });
      if (existing) {
        const newExpiry =
          existing.expiresAt && existing.expiresAt > expiresAt
            ? existing.expiresAt
            : expiresAt;
        existing.expiresAt = newExpiry;
        existing.status = "active";
        existing.source = "bundle-founder";
        existing.tier = "pro";
        await existing.save();
        return;
      }
      await Entitlement.create({
        userId,
        product,
        tier: "pro",
        status: "active",
        expiresAt,
        source: "bundle-founder",
      });
    })
  );
}
