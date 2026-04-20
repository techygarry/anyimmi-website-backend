import { app } from "./app.js";
import { connectDB } from "./config/database.js";
import { pingPostgres } from "./db/client.js";
import { env } from "./config/env.js";
import { logger } from "./utils/logger.js";

const start = async () => {
  // Postgres first — non-fatal. Admin routes still need Mongo.
  try {
    const ok = await pingPostgres();
    if (!ok) {
      logger.warn("Postgres ping failed — continuing with Mongo only");
    }
  } catch (err) {
    logger.warn("Postgres ping threw — continuing with Mongo only", err);
  }

  await connectDB();
  app.listen(env.PORT, () => {
    logger.info(`API running on port ${env.PORT} [${env.NODE_ENV}]`);

    // Stripe status
    const stripeKey = env.STRIPE_SECRET_KEY;
    if (stripeKey.startsWith("sk_live_")) {
      logger.info("Stripe: LIVE mode");
    } else if (stripeKey.startsWith("sk_test_")) {
      logger.warn("Stripe: TEST mode");
    } else {
      logger.error("Stripe: NOT CONFIGURED (placeholder key)");
    }

    // Resend status
    const resendKey = env.RESEND_API_KEY;
    if (resendKey.startsWith("re_") && resendKey !== "re_placeholder") {
      logger.info(`Resend: configured (from: ${env.RESEND_FROM_EMAIL})`);
    } else if (env.USE_SMTP) {
      logger.info(`SMTP: configured (${env.SMTP_HOST}:${env.SMTP_PORT})`);
    } else {
      logger.warn("Email: NOT CONFIGURED (placeholder key, SMTP disabled)");
    }

    // Stripe Webhook status
    const whSecret = env.STRIPE_WEBHOOK_SECRET;
    if (whSecret.startsWith("whsec_") && whSecret !== "whsec_placeholder") {
      logger.info("Stripe Webhook: configured");
    } else {
      logger.error("Stripe Webhook: NOT CONFIGURED (placeholder secret)");
    }

    // Frontend URLs
    logger.info(`Frontend Bundle URL: ${env.FRONTEND_BUNDLE_URL}`);
    logger.info(`Frontend Portal URL: ${env.FRONTEND_PORTAL_URL}`);
  });
};

start();
