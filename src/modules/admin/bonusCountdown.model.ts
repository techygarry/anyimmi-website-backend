import mongoose, { Document, Schema, Types } from "mongoose";

export interface IBonusCountdown extends Document {
  _id: Types.ObjectId;
  expiresAt: Date;
  bonusDescription: string;
  active: boolean;
  updatedAt: Date;
  createdAt: Date;
}

const DEFAULT_DESCRIPTION =
  "After Sunday midnight, THE FOUNDER drops the 3-month free trial to 30 days, removes the 1-on-1 call, and removes lifetime grandfathering.";

const bonusCountdownSchema = new Schema<IBonusCountdown>(
  {
    expiresAt: { type: Date, required: true },
    bonusDescription: { type: String, default: DEFAULT_DESCRIPTION },
    active: { type: Boolean, default: true },
  },
  { timestamps: true }
);

export const BonusCountdown = mongoose.model<IBonusCountdown>(
  "BonusCountdown",
  bonusCountdownSchema
);

/**
 * Next Sunday at 23:59:59 UTC, relative to `from`.
 * If `from` is already Sunday past 23:59:59 UTC, pushes to the following Sunday.
 */
export function nextSundayMidnightUTC(from: Date = new Date()): Date {
  const next = new Date(from.getTime());
  const daysUntilSunday = (7 - next.getUTCDay()) % 7; // 0 if already Sunday
  next.setUTCDate(next.getUTCDate() + daysUntilSunday);
  next.setUTCHours(23, 59, 59, 999);
  if (next.getTime() <= from.getTime()) {
    // Same Sunday but already past the cutoff — push to next Sunday.
    next.setUTCDate(next.getUTCDate() + 7);
  }
  return next;
}

/** Singleton doc — create with defaults on first read. */
export async function getBonusCountdown(): Promise<IBonusCountdown> {
  const existing = await BonusCountdown.findOne();
  if (existing) return existing;
  return BonusCountdown.create({
    expiresAt: nextSundayMidnightUTC(),
    bonusDescription: DEFAULT_DESCRIPTION,
    active: true,
  });
}

export async function updateBonusCountdown(
  patch: Partial<
    Pick<IBonusCountdown, "expiresAt" | "bonusDescription" | "active">
  >
): Promise<IBonusCountdown> {
  // Ensure the doc exists first so upsert with $set on required `expiresAt` is safe.
  await getBonusCountdown();
  const updated = await BonusCountdown.findOneAndUpdate(
    {},
    { $set: patch },
    { new: true }
  );
  return updated!;
}
