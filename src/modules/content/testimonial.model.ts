import mongoose, { Document, Schema, Types } from "mongoose";

export interface ITestimonial extends Document {
  _id: Types.ObjectId;
  name: string;
  role: string;
  text: string;
  rating: number;
  avatarColor: string;
  sortOrder: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const testimonialSchema = new Schema<ITestimonial>(
  {
    name: { type: String, required: true, trim: true },
    role: { type: String, required: true, trim: true },
    text: { type: String, required: true },
    rating: { type: Number, default: 5, min: 1, max: 5 },
    avatarColor: { type: String, default: "#573CFF" },
    sortOrder: { type: Number, default: 0 },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

testimonialSchema.index({ sortOrder: 1 });

export const Testimonial = mongoose.model<ITestimonial>(
  "Testimonial",
  testimonialSchema
);
