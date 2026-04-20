import mongoose, { Document, Schema, Types } from "mongoose";

export interface IFounderCounter extends Document {
  _id: Types.ObjectId;
  current: number;
  target: number;
  active: boolean;
  updatedAt: Date;
  createdAt: Date;
}

const founderCounterSchema = new Schema<IFounderCounter>(
  {
    current: { type: Number, default: 287, min: 0 },
    target: { type: Number, default: 500, min: 1 },
    active: { type: Boolean, default: true },
  },
  { timestamps: true }
);

export const FounderCounter = mongoose.model<IFounderCounter>(
  "FounderCounter",
  founderCounterSchema
);

/** Always return the singleton doc, creating it with defaults if missing. */
export async function getFounderCounter(): Promise<IFounderCounter> {
  const existing = await FounderCounter.findOne();
  if (existing) return existing;
  return FounderCounter.create({});
}

/** Atomically +1 the current counter (creating the doc if needed). */
export async function incrementFounderCounter(): Promise<IFounderCounter> {
  const updated = await FounderCounter.findOneAndUpdate(
    {},
    { $inc: { current: 1 } },
    { new: true, upsert: true, setDefaultsOnInsert: true }
  );
  return updated!;
}

export async function updateFounderCounter(
  patch: Partial<Pick<IFounderCounter, "current" | "target" | "active">>
): Promise<IFounderCounter> {
  const updated = await FounderCounter.findOneAndUpdate(
    {},
    { $set: patch },
    { new: true, upsert: true, setDefaultsOnInsert: true }
  );
  return updated!;
}
