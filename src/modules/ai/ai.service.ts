import { GoogleGenerativeAI } from "@google/generative-ai";
import { getGeminiApiKey, getGeminiModel } from "../../utils/settingsHelper.js";
import { sopPrompt } from "./prompts/sop.prompt.js";
import { calculateCRS, crsOptimizerPrompt } from "./prompts/crs.prompt.js";
import { coverLetterPrompt } from "./prompts/coverLetter.prompt.js";
import { eligibilityPrompt } from "./prompts/eligibility.prompt.js";

async function getModel() {
  const apiKey = await getGeminiApiKey();
  const modelName = await getGeminiModel();
  const genAI = new GoogleGenerativeAI(apiKey);
  return genAI.getGenerativeModel({ model: modelName });
}

export const generateSOP = async (input: Record<string, unknown>): Promise<string> => {
  const model = await getModel();
  const prompt = sopPrompt(input as any);
  const result = await model.generateContent(prompt);
  return result.response.text();
};

export const calculateAndOptimizeCRS = async (
  input: Record<string, unknown>
): Promise<{ score: ReturnType<typeof calculateCRS>; recommendations: string }> => {
  const model = await getModel();
  const score = calculateCRS(input as any);
  const prompt = crsOptimizerPrompt(score.total, score.breakdown, input as any);
  const result = await model.generateContent(prompt);
  return { score, recommendations: result.response.text() };
};

export const generateCoverLetter = async (input: Record<string, unknown>): Promise<string> => {
  const model = await getModel();
  const prompt = coverLetterPrompt(input as any);
  const result = await model.generateContent(prompt);
  return result.response.text();
};

export const assessEligibility = async (input: Record<string, unknown>): Promise<string> => {
  const model = await getModel();
  const prompt = eligibilityPrompt(input as any);
  const result = await model.generateContent(prompt);
  return result.response.text();
};
