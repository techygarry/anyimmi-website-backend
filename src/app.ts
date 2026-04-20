import express, { Request, Response, NextFunction } from "express";
import path from "path";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import cookieParser from "cookie-parser";
import { env } from "./config/env.js";

const app = express();

app.use(helmet({
  crossOriginResourcePolicy: { policy: "cross-origin" },
}));
const corsOrigins = Array.from(
  new Set(
    [
      env.FRONTEND_BUNDLE_URL,
      env.FRONTEND_PORTAL_URL,
      "http://localhost:3000", // unified dashboard (apps/app)
      "http://localhost:3030", // bundle marketing site
    ].filter(Boolean)
  )
);

app.use(
  cors({
    origin: corsOrigins,
    credentials: true,
  })
);

// Manual mongo sanitize (express-mongo-sanitize incompatible with Express 5 read-only req.query)
const sanitize = (obj: unknown): unknown => {
  if (obj && typeof obj === "object") {
    for (const key of Object.keys(obj as Record<string, unknown>)) {
      if (key.startsWith("$") || key.includes(".")) {
        delete (obj as Record<string, unknown>)[key];
      } else {
        (obj as Record<string, unknown>)[key] = sanitize(
          (obj as Record<string, unknown>)[key]
        );
      }
    }
  }
  return obj;
};

app.use((req: Request, _res: Response, next: NextFunction) => {
  if (req.body) sanitize(req.body);
  if (req.params) sanitize(req.params);
  next();
});

// Stripe webhook raw body — MUST be before express.json()
app.use(
  "/api/webhooks/stripe",
  express.raw({ type: "application/json" })
);

app.use(express.json({ limit: "10mb" }));
app.use(cookieParser());
app.use(morgan("dev"));

// Serve local uploads (category images + bundle files).
// CORS open for these so the dashboard at :3000 can <iframe> PDFs and
// trigger anchor downloads from a different origin without preflight pain.
// In prod swap to S3/CDN with the same paths — controllers and frontends
// don't need to change.
app.use(
  "/uploads",
  (_req, res, next) => {
    res.set("Access-Control-Allow-Origin", "*");
    res.set("Cross-Origin-Resource-Policy", "cross-origin");
    next();
  },
  express.static(path.join(__dirname, "../uploads"), { maxAge: "1d" }),
);

// Health check
app.get("/api/health", (_req, res) => {
  res.json({ status: "ok", time: new Date() });
});

// Routes
import authRoutes from "./modules/auth/auth.routes.js";
import usersRoutes from "./modules/users/users.routes.js";
import assetsRoutes from "./modules/assets/assets.routes.js";
import aiRoutes from "./modules/ai/ai.routes.js";
import paymentsRoutes from "./modules/payments/payments.routes.js";
import adminRoutes from "./modules/admin/admin.routes.js";
import contentRoutes from "./modules/content/content.routes.js";
import contactRoutes from "./modules/contact/contact.routes.js";
import marketingRoutes from "./modules/marketing/marketing.routes.js";
import { stripeWebhook } from "./modules/payments/stripe.webhook.js";
import { errorHandler } from "./middleware/errorHandler.js";

app.use("/api/auth", authRoutes);
app.use("/api/users", usersRoutes);
app.use("/api/assets", assetsRoutes);
app.use("/api/ai", aiRoutes);
app.use("/api/payments", paymentsRoutes);
app.post("/api/webhooks/stripe", stripeWebhook);
app.use("/api/admin", adminRoutes);
app.use("/api/content", contentRoutes);
app.use("/api/contact", contactRoutes);
app.use("/api/marketing", marketingRoutes);

// Error handler (must be last)
app.use(errorHandler);

export { app };
