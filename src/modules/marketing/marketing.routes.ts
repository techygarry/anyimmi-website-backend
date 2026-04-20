import { Router } from "express";
import multer from "multer";
import { authenticate } from "../../middleware/authenticate.js";
import { authorize } from "../../middleware/authorize.js";
import {
  getLeads,
  getLeadStats,
  uploadCsv,
  firecrawlScrape,
  bulkEmail,
  testEmail,
  deleteLeads,
  updateLead,
  bulkWhatsApp,
  testWhatsApp,
  getTemplates,
  createTemplate,
  updateTemplate,
  deleteTemplate,
  generateEmailTemplate,
} from "./marketing.controller.js";

const router = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

router.use(authenticate, authorize("admin"));

router.get("/leads", getLeads);
router.get("/leads/stats", getLeadStats);
router.patch("/leads/:id", updateLead);
router.post("/leads/delete", deleteLeads);
router.post("/leads/upload-csv", upload.single("file"), uploadCsv);
router.post("/leads/firecrawl", firecrawlScrape);
router.post("/leads/bulk-email", bulkEmail);
router.post("/leads/test-email", testEmail);
router.post("/leads/bulk-whatsapp", bulkWhatsApp);
router.post("/leads/test-whatsapp", testWhatsApp);

// Email Templates + AI
router.get("/templates", getTemplates);
router.post("/templates", createTemplate);
router.patch("/templates/:id", updateTemplate);
router.delete("/templates/:id", deleteTemplate);
router.post("/templates/generate", generateEmailTemplate);

export default router;
