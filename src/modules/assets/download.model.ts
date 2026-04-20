import mongoose, { Document, Schema, Types } from "mongoose";

export interface IDownload extends Document {
  _id: Types.ObjectId;
  userId: Types.ObjectId;
  assetId: Types.ObjectId;
  downloadedAt: Date;
}

const downloadSchema = new Schema<IDownload>({
  userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
  assetId: { type: Schema.Types.ObjectId, ref: "Asset", required: true },
  downloadedAt: { type: Date, default: Date.now },
});

downloadSchema.index({ userId: 1 });
downloadSchema.index({ assetId: 1 });

export const Download = mongoose.model<IDownload>("Download", downloadSchema);
