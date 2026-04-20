import mongoose, { Document, Schema, Types } from "mongoose";

export interface IAIGeneration extends Document {
  _id: Types.ObjectId;
  userId: Types.ObjectId;
  toolType: "sop" | "crs" | "cover-letter" | "eligibility";
  input: Record<string, unknown>;
  output: string;
  tokensUsed?: number;
  aiModel?: string;
  cost?: number;
  createdAt: Date;
}

const aiGenerationSchema = new Schema<IAIGeneration>({
  userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
  toolType: {
    type: String,
    enum: ["sop", "crs", "cover-letter", "eligibility"],
    required: true,
  },
  input: { type: Schema.Types.Mixed, required: true },
  output: { type: String, required: true },
  tokensUsed: { type: Number },
  aiModel: { type: String },
  cost: { type: Number },
  createdAt: { type: Date, default: Date.now },
});

aiGenerationSchema.index({ userId: 1, createdAt: -1 });

export const AIGeneration = mongoose.model<IAIGeneration>(
  "AIGeneration",
  aiGenerationSchema
);
