import mongoose, { Document, Schema, Types } from "mongoose";

export interface IAsset extends Document {
  _id: Types.ObjectId;
  name: string;
  description: string;
  category: Types.ObjectId;
  tags: string[];
  fileFormat: "docx" | "pdf" | "xlsx" | "pptx" | "psd" | "png" | "html" | "zip" | "rar";
  fileUrl: string;
  driveUrl?: string;
  sourceType: "spaces" | "drive";
  previewUrl?: string;
  fileSize?: number;
  isExternal: boolean;
  isFree: boolean;
  programType: string[];
  bundleCategory?: string;
  downloadCount: number;
  viewCount: number;
  createdAt: Date;
  updatedAt: Date;
}

const assetSchema = new Schema<IAsset>(
  {
    name: { type: String, required: true },
    description: { type: String, default: "" },
    category: { type: Schema.Types.ObjectId, ref: "Category", required: true },
    tags: [{ type: String }],
    fileFormat: {
      type: String,
      enum: ["docx", "pdf", "xlsx", "pptx", "psd", "png", "html", "zip", "rar"],
      required: true,
    },
    fileUrl: { type: String, default: "" },
    driveUrl: { type: String, default: "" },
    sourceType: { type: String, enum: ["spaces", "drive"], default: "spaces" },
    previewUrl: { type: String },
    fileSize: { type: Number },
    isExternal: { type: Boolean, default: false },
    isFree: { type: Boolean, default: false },
    programType: [
      {
        type: String,
        enum: [
          "express-entry",
          "study-permit",
          "work-permit",
          "spousal",
          "visitor",
          "general",
        ],
      },
    ],
    bundleCategory: { type: String },
    downloadCount: { type: Number, default: 0 },
    viewCount: { type: Number, default: 0 },
  },
  { timestamps: true }
);

assetSchema.index({ name: "text", description: "text", tags: "text" });
assetSchema.index({ category: 1 });
assetSchema.index({ fileFormat: 1 });

export const Asset = mongoose.model<IAsset>("Asset", assetSchema);
