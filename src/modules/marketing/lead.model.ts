import mongoose, { Document, Schema, Types } from "mongoose";

export interface ILead extends Document {
  _id: Types.ObjectId;
  name: string;
  email?: string;
  phone?: string;
  website?: string;
  address?: string;
  rating?: number;
  reviews?: number;
  mainCategory?: string;
  categories?: string;
  placeId?: string;
  query?: string;
  source: "csv" | "manual" | "firecrawl";
  status: "new" | "emailed" | "replied" | "converted" | "unsubscribed";
  tags: string[];
  notes?: string;
  lastEmailedAt?: Date;
  emailCount: number;
  firecrawlData?: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

const leadSchema = new Schema<ILead>(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, trim: true, lowercase: true },
    phone: { type: String, trim: true },
    website: { type: String, trim: true },
    address: { type: String, trim: true },
    rating: { type: Number },
    reviews: { type: Number },
    mainCategory: { type: String, trim: true },
    categories: { type: String, trim: true },
    placeId: { type: String, trim: true },
    query: { type: String, trim: true },
    source: { type: String, enum: ["csv", "manual", "firecrawl"], default: "csv" },
    status: { type: String, enum: ["new", "emailed", "replied", "converted", "unsubscribed"], default: "new" },
    tags: [{ type: String, trim: true }],
    notes: { type: String },
    lastEmailedAt: { type: Date },
    emailCount: { type: Number, default: 0 },
    firecrawlData: { type: Schema.Types.Mixed },
  },
  { timestamps: true }
);

leadSchema.index({ email: 1 });
leadSchema.index({ status: 1 });
leadSchema.index({ source: 1 });

export const Lead = mongoose.model<ILead>("Lead", leadSchema);
