import { Router } from "express";
import { authenticate } from "../../middleware/authenticate.js";
import { validate } from "../../middleware/validate.js";
import { aiRateLimiter } from "../../middleware/rateLimiter.js";
import { sopSchema, crsSchema, coverLetterSchema, eligibilitySchema } from "./ai.validator.js";
import {
  sopGenerator,
  crsCalculator,
  coverLetterGenerator,
  eligibilityAssessment,
  getHistory,
  getGeneration,
} from "./ai.controller.js";

const router = Router();

router.use(authenticate);

router.post("/sop-generator", validate(sopSchema), aiRateLimiter, sopGenerator);
router.post("/crs-calculator", validate(crsSchema), aiRateLimiter, crsCalculator);
router.post("/cover-letter", validate(coverLetterSchema), aiRateLimiter, coverLetterGenerator);
router.post("/eligibility", validate(eligibilitySchema), aiRateLimiter, eligibilityAssessment);
router.get("/history", getHistory);
router.get("/history/:id", getGeneration);

export default router;
