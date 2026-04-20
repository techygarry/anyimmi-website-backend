import mongoose, { Document, Schema, Types } from "mongoose";

export interface ICategory extends Document {
  _id: Types.ObjectId;
  name: string;
  slug: string;
  description?: string;
  longDescription?: string;
  icon?: string;
  image?: string;
  fileCount?: string;
  features: string[];
  previewImages: string[];
  useCases: string[];
  assetCount: number;
  sortOrder: number;
  isLocked?: boolean;
  unlockTier?: string;
}

const categorySchema = new Schema<ICategory>(
  {
    name: { type: String, required: true },
    slug: { type: String, required: true, unique: true },
    description: { type: String },
    longDescription: { type: String },
    icon: { type: String },
    image: { type: String },
    fileCount: { type: String },
    features: { type: [String], default: [] },
    previewImages: { type: [String], default: [] },
    useCases: { type: [String], default: [] },
    assetCount: { type: Number, default: 0 },
    sortOrder: { type: Number, default: 0 },
    isLocked: { type: Boolean, default: false },
    unlockTier: { type: String },
  },
  { timestamps: true }
);

export const Category = mongoose.model<ICategory>("Category", categorySchema);
