import { Request, Response } from "express";
import crypto from "crypto";
import bcrypt from "bcryptjs";
import { stripe } from "../../config/stripe.js";
import { env } from "../../config/env.js";
import { Order } from "./order.model.js";
import { User } from "../users/user.model.js";
import { logger } from "../../utils/logger.js";
import Stripe from "stripe";
import { sendWelcomeEmail, sendInvoiceEmail } from "../email/email.service.js";
import { generateInvoiceNumber } from "../../utils/invoiceNumber.js";
import { getBundlePlanByTier, getPortalPlanById } from "../../utils/settingsHelper.js";

// These events are expected but don't need processing
const IGNORED_EVENTS = new Set([
  "charge.succeeded",
  "charge.updated",
  "payment_intent.created",
  "payment_intent.succeeded",
  "payment_method.attached",
  "customer.created",
  "customer.updated",
]);

export const stripeWebhook = async (req: Request, res: Response) => {
  logger.info(`Stripe webhook received (${req.headers["stripe-signature"] ? "signed" : "UNSIGNED"})`);
  const sig = req.headers["stripe-signature"] as string;

  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(
      req.body,
      sig,
      env.STRIPE_WEBHOOK_SECRET
    );
  } catch (err) {
    logger.error("Stripe webhook signature verification failed", err);
    res.status(400).json({ error: "Invalid signature" });
    return;
  }

  logger.info(`Stripe webhook event: ${event.type} [${event.id}]`);

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;

        // Idempotency check
        const existing = await Order.findOne({
          stripeSessionId: session.id,
        });
        if (existing) {
          res.status(200).json({ received: true });
          return;
        }

        const tier = session.metadata?.tier;
        const plan = session.metadata?.plan;
        const email = session.customer_details?.email || session.customer_email;

        if (!email) {
          logger.error("No email in Stripe session", { sessionId: session.id });
          res.status(200).json({ received: true });
          return;
        }

        const bundlePlan = tier ? await getBundlePlanByTier(tier) : undefined;
        if (bundlePlan) {
          // Bundle purchase
          const proMonths = bundlePlan.portalProMonths;
          const portalProExpiresAt = new Date();
          portalProExpiresAt.setMonth(
            portalProExpiresAt.getMonth() + proMonths
          );

          // Find or create user
          let user = await User.findOne({ email });
          let tempPassword: string | undefined;
          if (!user) {
            // Generate a temporary password for guest buyers
            tempPassword = crypto.randomBytes(6).toString("base64url"); // e.g. "aB3dEf_g"
            const hashedPassword = await bcrypt.hash(tempPassword, 12);
            user = await User.create({
              name: session.customer_details?.name || "Bundle Buyer",
              email,
              password: hashedPassword,
              isEmailVerified: true,
              plan: "pro",
              portalProExpiresAt,
            });
          } else {
            user.plan = "pro";
            user.portalProExpiresAt = portalProExpiresAt;
            await user.save();
          }

          // Create order
          const invoiceNumber = await generateInvoiceNumber();
          const orderAmount = (session.amount_total || 0) / 100;
          const orderCurrency = session.currency || "usd";
          const customerName = session.customer_details?.name || undefined;

          await Order.create({
            userId: user._id,
            email,
            name: customerName,
            invoiceNumber,
            stripeSessionId: session.id,
            stripePaymentIntent: session.payment_intent as string,
            stripeCustomerId: session.customer as string,
            tier,
            amount: orderAmount,
            currency: orderCurrency,
            status: "completed",
            deliveryStatus: "pending",
            portalAccessGranted: true,
            portalProMonths: proMonths,
          });

          logger.info(`Bundle purchase: ${tier} by ${email} ($${orderAmount})`);

          // Send welcome email (with temp password for new users)
          await sendWelcomeEmail({
            email,
            name: customerName || "there",
            tier: tier!,
            tempPassword,
          });

          // Send invoice email
          sendInvoiceEmail({
            email,
            name: customerName || "Customer",
            invoiceNumber,
            tier: tier!,
            amount: orderAmount,
            currency: orderCurrency,
            portalProMonths: proMonths,
            date: new Date(),
            stripePaymentIntent: session.payment_intent as string,
          }).catch((err) => logger.error("Failed to send invoice email", err));
        }

        const portalPlan = plan ? await getPortalPlanById(plan) : undefined;
        if (portalPlan) {
          // Portal subscription
          const userId = session.metadata?.userId;
          if (userId) {
            const user = await User.findById(userId);
            if (user) {
              user.plan = plan as "pro" | "business";
              user.subscriptionId = session.subscription as string;
              user.subscriptionStatus = "active";
              user.stripeCustomerId = session.customer as string;
              await user.save();
            }
          }

          const subInvoiceNumber = await generateInvoiceNumber();
          const subAmount = (session.amount_total || 0) / 100;
          const subCurrency = session.currency || "usd";
          const subTier = plan === "pro" ? "portal_pro" : "portal_business";

          await Order.create({
            userId,
            email,
            invoiceNumber: subInvoiceNumber,
            stripeSessionId: session.id,
            stripeCustomerId: session.customer as string,
            tier: subTier,
            amount: subAmount,
            currency: subCurrency,
            status: "completed",
            deliveryStatus: "email_sent",
            portalAccessGranted: true,
          });

          logger.info(`Portal subscription: ${plan} by ${email}`);

          // Send invoice email
          sendInvoiceEmail({
            email,
            name: session.customer_details?.name || "Customer",
            invoiceNumber: subInvoiceNumber,
            tier: subTier,
            amount: subAmount,
            currency: subCurrency,
            portalProMonths: 0,
            date: new Date(),
            stripePaymentIntent: session.payment_intent as string,
          }).catch((err) => logger.error("Failed to send invoice email", err));
        }
        break;
      }

      case "customer.subscription.deleted": {
        const subscription = event.data.object as Stripe.Subscription;
        const user = await User.findOne({
          subscriptionId: subscription.id,
        });
        if (user) {
          user.plan = "free";
          user.subscriptionId = undefined;
          user.subscriptionStatus = "canceled";
          await user.save();
          logger.info(`Subscription cancelled for ${user.email}`);
        }
        break;
      }

      default:
        if (!IGNORED_EVENTS.has(event.type)) {
          logger.debug(`Unhandled Stripe event: ${event.type}`);
        }
    }
  } catch (err) {
    logger.error("Stripe webhook processing error", err);
    // Still return 200 to prevent Stripe retries
  }

  res.status(200).json({ received: true });
};
