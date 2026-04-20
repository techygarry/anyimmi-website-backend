import { GoogleGenerativeAI } from "@google/generative-ai";
import { env } from "./env.js";

export const genAI = new GoogleGenerativeAI(env.GEMINI_API_KEY);
