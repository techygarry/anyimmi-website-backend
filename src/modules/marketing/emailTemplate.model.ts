import mongoose, { Document, Schema, Types } from "mongoose";

export interface IEmailTemplate extends Document {
  _id: Types.ObjectId;
  name: string;
  subject: string;
  htmlBody: string;
  createdAt: Date;
  updatedAt: Date;
}

const emailTemplateSchema = new Schema<IEmailTemplate>(
  {
    name: { type: String, required: true, trim: true },
    subject: { type: String, required: true, trim: true },
    htmlBody: { type: String, required: true },
  },
  { timestamps: true }
);

export const EmailTemplate = mongoose.model<IEmailTemplate>("EmailTemplate", emailTemplateSchema);
