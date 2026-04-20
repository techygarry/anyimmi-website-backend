import mongoose, { Document, Schema, Types } from "mongoose";

export interface ISubCategory extends Document {
  _id: Types.ObjectId;
  name: string;
  slug: string;
  description?: string;
  format?: string;
  category: Types.ObjectId;
  previewImages: string[];
  sortOrder: number;
}

const subCategorySchema = new Schema<ISubCategory>(
  {
    name: { type: String, required: true },
    slug: { type: String, required: true },
    description: { type: String },
    format: { type: String },
    category: { type: Schema.Types.ObjectId, ref: "Category", required: true },
    previewImages: { type: [String], default: [] },
    sortOrder: { type: Number, default: 0 },
  },
  { timestamps: true }
);

// Slug must be unique within a category
subCategorySchema.index({ category: 1, slug: 1 }, { unique: true });

export const SubCategory = mongoose.model<ISubCategory>("SubCategory", subCategorySchema);
