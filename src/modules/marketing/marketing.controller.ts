import { Request, Response } from "express";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { Lead } from "./lead.model.js";
import { EmailTemplate } from "./emailTemplate.model.js";
import { logger } from "../../utils/logger.js";
import { getFirecrawlApiKey, getWhatsAppConfig, getGeminiApiKey, getGeminiModel } from "../../utils/settingsHelper.js";
import { sendMarketingEmail } from "./marketing.mailer.js";

// ─── GET all leads ──────────────────────────────────────────────
export const getLeads = async (req: Request, res: Response) => {
  const { status, source, search, hasEmail, hasPhone, page = "1", limit = "50" } = req.query as Record<string, string>;
  const filter: Record<string, unknown> = {};
  if (status) filter.status = status;
  if (source) filter.source = source;
  if (hasEmail === "true") filter.email = { $exists: true, $ne: "" };
  if (hasPhone === "true") filter.phone = { $exists: true, $ne: "" };
  if (search) {
    filter.$or = [
      { name: { $regex: search, $options: "i" } },
      { email: { $regex: search, $options: "i" } },
      { website: { $regex: search, $options: "i" } },
    ];
  }
  const skip = (Number(page) - 1) * Number(limit);
  const [leads, total] = await Promise.all([
    Lead.find(filter).sort({ createdAt: -1 }).skip(skip).limit(Number(limit)),
    Lead.countDocuments(filter),
  ]);
  res.json({ data: leads, total, page: Number(page), pages: Math.ceil(total / Number(limit)) });
};

// ─── GET lead stats ─────────────────────────────────────────────
export const getLeadStats = async (_req: Request, res: Response) => {
  const [total, withEmail, withPhone, emailed, newLeads] = await Promise.all([
    Lead.countDocuments(),
    Lead.countDocuments({ email: { $exists: true, $ne: "" } }),
    Lead.countDocuments({ phone: { $exists: true, $ne: "" } }),
    Lead.countDocuments({ status: "emailed" }),
    Lead.countDocuments({ status: "new" }),
  ]);
  res.json({ data: { total, withEmail, withPhone, emailed, newLeads } });
};

// ─── Upload CSV ─────────────────────────────────────────────────
export const uploadCsv = async (req: Request, res: Response) => {
  if (!req.file) {
    res.status(400).json({ error: "No CSV file uploaded" });
    return;
  }

  const csv = req.file.buffer.toString("utf-8");
  const rows = parseCsvRows(csv);
  if (rows.length < 2) {
    res.status(400).json({ error: "CSV is empty or has no data rows" });
    return;
  }

  const headers = rows[0].map((h) => h.trim().toLowerCase().replace(/[^a-z0-9_]/g, "_"));

  const colMap: Record<string, string> = {
    name: "name",
    phone: "phone",
    website: "website",
    address: "address",
    rating: "rating",
    reviews: "reviews",
    main_category: "mainCategory",
    categories: "categories",
    place_id: "placeId",
    query: "query",
    email: "email",
    description: "notes",
    review_keywords: "tags",
  };

  const leads: Record<string, unknown>[] = [];
  let skipped = 0;

  for (let i = 1; i < rows.length; i++) {
    const values = rows[i];
    if (values.length < 2) continue;

    const row: Record<string, unknown> = {};
    headers.forEach((h, idx) => {
      if (idx < values.length) {
        const field = colMap[h];
        if (field && values[idx].trim()) {
          if (!row[field]) row[field] = values[idx].trim();
        }
      }
    });

    if (!row.name || !(row.name as string).trim()) {
      skipped++;
      continue;
    }

    if (row.rating) row.rating = parseFloat(row.rating as string) || undefined;
    if (row.reviews) row.reviews = parseInt(row.reviews as string, 10) || undefined;

    if (row.tags && typeof row.tags === "string") {
      row.tags = (row.tags as string).split(",").map((t: string) => t.trim()).filter(Boolean);
    } else {
      row.tags = [];
    }

    row.source = "csv";
    row.status = "new";
    row.emailCount = 0;
    leads.push(row);
  }

  if (leads.length === 0) {
    res.status(400).json({ error: "No valid leads found in CSV" });
    return;
  }

  let imported = 0;
  for (const lead of leads) {
    try {
      if (lead.placeId) {
        const existing = await Lead.findOne({ placeId: lead.placeId });
        if (existing) {
          skipped++;
          continue;
        }
      }
      await Lead.create(lead);
      imported++;
    } catch {
      skipped++;
    }
  }

  res.json({ data: { imported, skipped, total: rows.length - 1 } });
};

// ─── Firecrawl scrape website for emails ────────────────────────
export const firecrawlScrape = async (req: Request, res: Response) => {
  const { leadIds } = req.body as { leadIds: string[] };
  if (!leadIds?.length) {
    res.status(400).json({ error: "No lead IDs provided" });
    return;
  }

  const firecrawlKey = await getFirecrawlApiKey();
  if (!firecrawlKey || firecrawlKey === "firecrawl_placeholder") {
    res.status(400).json({ error: "Firecrawl API key not configured" });
    return;
  }

  let found = 0;
  let failed = 0;
  const results: { id: string; email?: string; error?: string }[] = [];

  for (const id of leadIds) {
    const lead = await Lead.findById(id);
    if (!lead || !lead.website) {
      failed++;
      results.push({ id, error: "No website" });
      continue;
    }

    try {
      let url = lead.website;
      if (!url.startsWith("http")) url = "https://" + url;

      const fcRes = await fetch("https://api.firecrawl.dev/v1/scrape", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${firecrawlKey}`,
        },
        body: JSON.stringify({ url, formats: ["markdown"] }),
      });

      const fcData = (await fcRes.json()) as Record<string, unknown>;
      if (!fcRes.ok) {
        failed++;
        results.push({ id, error: (fcData.error as string) || "Firecrawl error" });
        continue;
      }

      const markdown = ((fcData.data as Record<string, unknown>)?.markdown as string) || "";
      const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
      const emails = [...new Set(markdown.match(emailRegex) || [])];
      const filtered = emails.filter(
        (e) => !e.includes("example.com") && !e.includes("sentry") && !e.includes("wixpress")
      );

      if (filtered.length > 0) {
        lead.email = filtered[0];
        lead.firecrawlData = { allEmails: filtered, scrapedAt: new Date() };
        await lead.save();
        found++;
        results.push({ id, email: filtered[0] });
      } else {
        // Try contact page
        const contactRes = await fetch("https://api.firecrawl.dev/v1/scrape", {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${firecrawlKey}` },
          body: JSON.stringify({ url: url.replace(/\/$/, "") + "/contact", formats: ["markdown"] }),
        });
        const contactData = (await contactRes.json()) as Record<string, unknown>;
        const contactMd = ((contactData.data as Record<string, unknown>)?.markdown as string) || "";
        const contactEmails = [...new Set(contactMd.match(emailRegex) || [])].filter(
          (e) => !e.includes("example.com") && !e.includes("sentry") && !e.includes("wixpress")
        );

        if (contactEmails.length > 0) {
          lead.email = contactEmails[0];
          lead.firecrawlData = { allEmails: contactEmails, scrapedAt: new Date(), source: "contact-page" };
          await lead.save();
          found++;
          results.push({ id, email: contactEmails[0] });
        } else {
          failed++;
          results.push({ id, error: "No email found" });
        }
      }
    } catch (err) {
      failed++;
      results.push({ id, error: "Scrape failed" });
      logger.error(`Firecrawl scrape error for lead ${id}`, err);
    }
  }

  res.json({ data: { found, failed, total: leadIds.length, results } });
};

// ─── Bulk email leads ───────────────────────────────────────────
export const bulkEmail = async (req: Request, res: Response) => {
  const { leadIds, subject, htmlBody } = req.body as {
    leadIds: string[];
    subject: string;
    htmlBody: string;
  };

  if (!leadIds?.length || !subject || !htmlBody) {
    res.status(400).json({ error: "leadIds, subject, and htmlBody are required" });
    return;
  }

  let sent = 0;
  let failed = 0;
  const errors: { id: string; email?: string; error: string }[] = [];

  for (const id of leadIds) {
    const lead = await Lead.findById(id);
    if (!lead?.email) {
      failed++;
      errors.push({ id, error: "No email" });
      continue;
    }

    if (lead.status === "unsubscribed") {
      failed++;
      errors.push({ id, email: lead.email, error: "Unsubscribed" });
      continue;
    }

    try {
      const personalizedBody = htmlBody.replace(/\{\{name\}\}/g, lead.name || "there");
      await sendMarketingEmail(lead.email, subject, personalizedBody);

      lead.status = "emailed";
      lead.lastEmailedAt = new Date();
      lead.emailCount = (lead.emailCount || 0) + 1;
      await lead.save();
      sent++;
    } catch (err) {
      failed++;
      errors.push({ id, email: lead.email, error: "Send failed" });
      logger.error(`Bulk email failed for ${lead.email}`, err);
    }
  }

  res.json({ data: { sent, failed, total: leadIds.length, errors } });
};

// ─── Test email ─────────────────────────────────────────────────
export const testEmail = async (req: Request, res: Response) => {
  const { to, subject, htmlBody } = req.body as { to: string; subject: string; htmlBody: string };

  if (!to || !subject || !htmlBody) {
    res.status(400).json({ error: "to, subject, and htmlBody are required" });
    return;
  }

  try {
    await sendMarketingEmail(to, subject, htmlBody);
    logger.info(`Test email sent to ${to}`);
    res.json({ data: { success: true } });
  } catch (err) {
    logger.error(`Test email failed to ${to}`, err);
    res.status(500).json({ error: "Failed to send test email" });
  }
};

// ─── WhatsApp bulk send ─────────────────────────────────────────
export const bulkWhatsApp = async (req: Request, res: Response) => {
  const { leadIds } = req.body as { leadIds: string[] };

  if (!leadIds?.length) {
    res.status(400).json({ error: "leadIds are required" });
    return;
  }

  const config = await getWhatsAppConfig();
  if (!config.phoneNumberId || !config.accessToken) {
    res.status(400).json({ error: "WhatsApp API not configured. Set credentials in Settings." });
    return;
  }
  if (!config.templateName) {
    res.status(400).json({ error: "WhatsApp template name not configured in Settings." });
    return;
  }

  let sent = 0;
  let failed = 0;
  const errors: { id: string; phone?: string; error: string }[] = [];

  for (const id of leadIds) {
    const lead = await Lead.findById(id);
    if (!lead?.phone) {
      failed++;
      errors.push({ id, error: "No phone" });
      continue;
    }

    // Normalize phone: remove spaces, dashes, parentheses. Keep + and digits
    const phone = lead.phone.replace(/[^+\d]/g, "");
    if (phone.length < 10) {
      failed++;
      errors.push({ id, phone: lead.phone, error: "Invalid phone number" });
      continue;
    }

    try {
      const waRes = await fetch(
        `${config.apiUrl}/${config.phoneNumberId}/messages`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${config.accessToken}`,
          },
          body: JSON.stringify({
            messaging_product: "whatsapp",
            to: phone,
            type: "template",
            template: {
              name: config.templateName,
              language: { code: config.templateLanguage || "en" },
            },
          }),
        }
      );

      const waData = (await waRes.json()) as Record<string, unknown>;

      if (!waRes.ok) {
        failed++;
        const errMsg = ((waData.error as Record<string, unknown>)?.message as string) || "WhatsApp API error";
        errors.push({ id, phone, error: errMsg });
        logger.error(`WhatsApp send failed for ${phone}: ${errMsg}`);
        continue;
      }

      sent++;
      logger.info(`WhatsApp sent to ${phone} for lead ${id}`);
    } catch (err) {
      failed++;
      errors.push({ id, phone, error: "Send failed" });
      logger.error(`WhatsApp send error for ${phone}`, err);
    }
  }

  res.json({ data: { sent, failed, total: leadIds.length, errors } });
};

// ─── Delete leads ───────────────────────────────────────────────
export const deleteLeads = async (req: Request, res: Response) => {
  const { leadIds } = req.body as { leadIds: string[] };
  if (!leadIds?.length) {
    res.status(400).json({ error: "No lead IDs provided" });
    return;
  }
  const result = await Lead.deleteMany({ _id: { $in: leadIds } });
  res.json({ data: { deleted: result.deletedCount } });
};

// ─── Update lead ────────────────────────────────────────────────
export const updateLead = async (req: Request, res: Response) => {
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const lead = await Lead.findByIdAndUpdate(id, req.body, { new: true, runValidators: true });
  if (!lead) {
    res.status(404).json({ error: "Lead not found" });
    return;
  }
  res.json({ data: lead });
};

// ─── Email Templates CRUD ───────────────────────────────────────
export const getTemplates = async (_req: Request, res: Response) => {
  const templates = await EmailTemplate.find().sort({ updatedAt: -1 });
  res.json({ data: templates });
};

export const createTemplate = async (req: Request, res: Response) => {
  const { name, subject, htmlBody } = req.body as { name: string; subject: string; htmlBody: string };
  if (!name || !subject || !htmlBody) {
    res.status(400).json({ error: "name, subject, and htmlBody are required" });
    return;
  }
  const template = await EmailTemplate.create({ name, subject, htmlBody });
  res.status(201).json({ data: template });
};

export const updateTemplate = async (req: Request, res: Response) => {
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const template = await EmailTemplate.findByIdAndUpdate(id, req.body, { new: true });
  if (!template) {
    res.status(404).json({ error: "Template not found" });
    return;
  }
  res.json({ data: template });
};

export const deleteTemplate = async (req: Request, res: Response) => {
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  await EmailTemplate.findByIdAndDelete(id);
  res.json({ data: { deleted: true } });
};

// ─── Test WhatsApp ──────────────────────────────────────────────
export const testWhatsApp = async (req: Request, res: Response) => {
  const { phone } = req.body as { phone: string };
  if (!phone?.trim()) {
    res.status(400).json({ error: "Phone number is required" });
    return;
  }

  const config = await getWhatsAppConfig();
  if (!config.phoneNumberId || !config.accessToken) {
    res.status(400).json({ error: "WhatsApp API not configured. Set credentials in Settings." });
    return;
  }
  if (!config.templateName) {
    res.status(400).json({ error: "WhatsApp template name not configured in Settings." });
    return;
  }

  const normalized = phone.replace(/[^+\d]/g, "");
  if (normalized.length < 10) {
    res.status(400).json({ error: "Invalid phone number" });
    return;
  }

  try {
    const waRes = await fetch(
      `${config.apiUrl}/${config.phoneNumberId}/messages`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${config.accessToken}`,
        },
        body: JSON.stringify({
          messaging_product: "whatsapp",
          to: normalized,
          type: "template",
          template: {
            name: config.templateName,
            language: { code: config.templateLanguage || "en" },
          },
        }),
      }
    );

    const waData = (await waRes.json()) as Record<string, unknown>;

    if (!waRes.ok) {
      const errMsg = ((waData.error as Record<string, unknown>)?.message as string) || "WhatsApp API error";
      logger.error(`Test WhatsApp failed for ${normalized}: ${errMsg}`);
      res.status(400).json({ error: errMsg });
      return;
    }

    logger.info(`Test WhatsApp sent to ${normalized}`);
    res.json({ data: { success: true } });
  } catch (err) {
    logger.error(`Test WhatsApp error for ${normalized}`, err);
    res.status(500).json({ error: "Failed to send test WhatsApp message" });
  }
};

// ─── AI Generate Email Template ─────────────────────────────────
export const generateEmailTemplate = async (req: Request, res: Response) => {
  const { prompt, businessName } = req.body as { prompt: string; businessName?: string };
  if (!prompt?.trim()) {
    res.status(400).json({ error: "Prompt is required" });
    return;
  }

  try {
    const apiKey = await getGeminiApiKey();
    const modelName = await getGeminiModel();

    if (!apiKey || apiKey === "gemini_api_key_placeholder") {
      res.status(400).json({ error: "Gemini API key not configured. Set it in Settings." });
      return;
    }

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: modelName });

    const systemPrompt = `You are a professional email copywriter specializing in immigration consulting and B2B outreach.
Generate a professional marketing email based on the user's requirements.

Return ONLY a valid JSON object with exactly these fields:
- "subject": The email subject line (concise, compelling)
- "htmlBody": The full HTML email body (use <p>, <br/>, <strong>, <ul>, <li> tags for formatting, keep it professional)

${businessName ? `The business/sender name is: ${businessName}` : ""}

Use {{name}} as a placeholder for the recipient's name.
Make the email professional, engaging, and action-oriented.
Do NOT include any markdown formatting or code fences in your response. Return ONLY the raw JSON object.`;

    const result = await model.generateContent(`${systemPrompt}\n\nUser request: ${prompt}`);
    const text = result.response.text();

    // Parse the JSON from the response (handle potential markdown wrapping)
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      res.status(500).json({ error: "Failed to parse AI response" });
      return;
    }

    const parsed = JSON.parse(jsonMatch[0]) as { subject: string; htmlBody: string };
    if (!parsed.subject || !parsed.htmlBody) {
      res.status(500).json({ error: "AI returned incomplete response" });
      return;
    }

    res.json({ data: { subject: parsed.subject, htmlBody: parsed.htmlBody } });
  } catch (err) {
    logger.error("AI email generation failed", err);
    res.status(500).json({ error: "Failed to generate email template" });
  }
};

// ─── Full CSV parser (handles multi-line quoted fields) ──────────
function parseCsvRows(csv: string): string[][] {
  const rows: string[][] = [];
  let current = "";
  let inQuotes = false;
  const fields: string[] = [];

  for (let i = 0; i < csv.length; i++) {
    const char = csv[i];

    if (char === '"') {
      if (inQuotes && csv[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === "," && !inQuotes) {
      fields.push(current);
      current = "";
    } else if ((char === "\n" || char === "\r") && !inQuotes) {
      if (char === "\r" && csv[i + 1] === "\n") i++;
      fields.push(current);
      current = "";
      if (fields.some((f) => f.trim())) {
        rows.push([...fields]);
      }
      fields.length = 0;
    } else {
      current += char;
    }
  }

  fields.push(current);
  if (fields.some((f) => f.trim())) {
    rows.push([...fields]);
  }

  return rows;
}
