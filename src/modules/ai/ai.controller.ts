import { Request, Response, NextFunction } from "express";
import { AIGeneration } from "./generation.model.js";
import { User } from "../users/user.model.js";
import { sendResponse, sendPaginated } from "../../utils/apiResponse.js";
import { AppError } from "../../utils/apiError.js";
import { getGeminiModel } from "../../utils/settingsHelper.js";
import {
  generateSOP,
  calculateAndOptimizeCRS,
  generateCoverLetter,
  assessEligibility,
} from "./ai.service.js";

export const sopGenerator = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const output = await generateSOP(req.body);
    const aiModelName = await getGeminiModel();

    await AIGeneration.create({
      userId: req.user!._id,
      toolType: "sop",
      input: req.body,
      output,
      aiModel: aiModelName,
    });

    await User.findByIdAndUpdate(req.user!._id, {
      $inc: { aiGenerationsThisMonth: 1 },
    });

    sendResponse(res, 200, { output }, "SOP generated successfully");
  } catch (err) {
    next(err);
  }
};

export const crsCalculator = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { score, recommendations } = await calculateAndOptimizeCRS(req.body);
    const aiModelName = await getGeminiModel();

    await AIGeneration.create({
      userId: req.user!._id,
      toolType: "crs",
      input: req.body,
      output: JSON.stringify({ score, recommendations }),
      aiModel: aiModelName,
    });

    await User.findByIdAndUpdate(req.user!._id, {
      $inc: { aiGenerationsThisMonth: 1 },
    });

    sendResponse(res, 200, { score, recommendations }, "CRS calculated successfully");
  } catch (err) {
    next(err);
  }
};

export const coverLetterGenerator = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const output = await generateCoverLetter(req.body);
    const aiModelName = await getGeminiModel();

    await AIGeneration.create({
      userId: req.user!._id,
      toolType: "cover-letter",
      input: req.body,
      output,
      aiModel: aiModelName,
    });

    await User.findByIdAndUpdate(req.user!._id, {
      $inc: { aiGenerationsThisMonth: 1 },
    });

    sendResponse(res, 200, { output }, "Cover letter generated successfully");
  } catch (err) {
    next(err);
  }
};

export const eligibilityAssessment = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const output = await assessEligibility(req.body);
    const aiModelName = await getGeminiModel();

    await AIGeneration.create({
      userId: req.user!._id,
      toolType: "eligibility",
      input: req.body,
      output,
      aiModel: aiModelName,
    });

    await User.findByIdAndUpdate(req.user!._id, {
      $inc: { aiGenerationsThisMonth: 1 },
    });

    sendResponse(res, 200, { output }, "Eligibility assessment completed");
  } catch (err) {
    next(err);
  }
};

export const getHistory = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;

    const [generations, total] = await Promise.all([
      AIGeneration.find({ userId: req.user!._id })
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .select("toolType input createdAt"),
      AIGeneration.countDocuments({ userId: req.user!._id }),
    ]);

    sendPaginated(res, generations, total, page, limit);
  } catch (err) {
    next(err);
  }
};

export const getGeneration = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const generation = await AIGeneration.findById(req.params.id);

    if (!generation) {
      throw new AppError("Generation not found", 404);
    }

    if (generation.userId.toString() !== req.user!._id.toString()) {
      throw new AppError("Not authorized", 403);
    }

    sendResponse(res, 200, generation);
  } catch (err) {
    next(err);
  }
};
