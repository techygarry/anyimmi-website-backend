import mongoose, { Document, Schema, Types } from "mongoose";

export interface ISliderImage extends Document {
  _id: Types.ObjectId;
  title: string;
  imageUrl: string;
  sliderType: string;
  sortOrder: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const sliderImageSchema = new Schema<ISliderImage>(
  {
    title: { type: String, required: true, trim: true },
    imageUrl: { type: String, required: true },
    sliderType: { type: String, default: "general", trim: true },
    sortOrder: { type: Number, default: 0 },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

sliderImageSchema.index({ sliderType: 1, sortOrder: 1 });

export const SliderImage = mongoose.model<ISliderImage>("SliderImage", sliderImageSchema);
