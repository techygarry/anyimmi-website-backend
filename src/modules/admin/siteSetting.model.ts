import mongoose, { Document, Schema, Types } from "mongoose";

export interface ISiteSetting extends Document {
  _id: Types.ObjectId;
  key: string;
  value: unknown;
  updatedAt: Date;
}

const siteSettingSchema = new Schema<ISiteSetting>(
  {
    key: { type: String, required: true, unique: true },
    value: { type: Schema.Types.Mixed },
  },
  { timestamps: true }
);

export const SiteSetting = mongoose.model<ISiteSetting>(
  "SiteSetting",
  siteSettingSchema
);
