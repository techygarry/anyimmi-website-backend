import { Request, Response } from "express";
import crypto from "crypto";
import bcrypt from "bcryptjs";
import { stripe } from "../../config/stripe.js";
import { env } from "../../config/env.js";
import { logger } from "../../utils/logger.js";
import Stripe from "stripe";
import { sendWelcomeEmail, sendInvoiceEmail } from "../email/email.service.js";
import { generateInvoiceNumber } from "../../utils/invoiceNumber.js";
import { getBundlePlanByTier, getPortalPlanById, resolveTierId } from "../../utils/settingsHelper.js";
import { grantFounderTrialEntitlementsPg } from "../users/entitlement.model.js";
import { incrementFounderCounter } from "../admin/founderCounter.repo.js";
import { db } from "../../db/client.js";
import {
  users as pgUsers,
  orders as pgOrders,
  organizations as pgOrgs,
} from "../../db/schema/index.js";
import { eq } from "drizzle-orm";

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

        // Idempotency check (Postgres orders)
        const [existingOrder] = await db
          .select({ id: pgOrders.id })
          .from(pgOrders)
          .where(eq(pgOrders.stripeCheckoutSessionId, session.id))
          .limit(1);
        if (existingOrder) {
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
        const resolvedTier = tier ? resolveTierId(tier) : undefined;
        if (bundlePlan) {
          // Bundle purchase
          const proMonths = bundlePlan.portalProMonths;
          const portalProExpiresAt = new Date();
          if (proMonths > 0) {
            portalProExpiresAt.setMonth(
              portalProExpiresAt.getMonth() + proMonths
            );
          }

          // Find or create user in Postgres (upsert on email).
          let tempPassword: string | undefined;
          const customerName =
            session.customer_details?.name || undefined;

          let [pgUser] = await db
            .select()
            .from(pgUsers)
            .where(eq(pgUsers.email, email))
            .limit(1);

          if (!pgUser) {
            tempPassword = crypto.randomBytes(6).toString("base64url");
            const hashedPassword = await bcrypt.hash(tempPassword, 12);
            const upserted = await db
              .insert(pgUsers)
              .values({
                email,
                name: customerName || "Bundle Buyer",
                passwordHash: hashedPassword,
                role: "owner",
                emailVerifiedAt: new Date(),
                portalProExpiresAt: proMonths > 0 ? portalProExpiresAt : null,
              })
              .onConflictDoUpdate({
                target: pgUsers.email,
                set: {
                  portalProExpiresAt:
                    proMonths > 0 ? portalProExpiresAt : null,
                  updatedAt: new Date(),
                },
              })
              .returning();
            pgUser = upserted[0];

            // Create solo org for the new user (best-effort).
            try {
              await db.insert(pgOrgs).values({
                type: "solo",
                name: `${customerName || email.split("@")[0]}'s workspace`,
                ownerUserId: pgUser.id,
              });
            } catch (err) {
              logger.error("Failed to create solo org for bundle buyer", err);
            }
          } else if (proMonths > 0) {
            await db
              .update(pgUsers)
              .set({
                portalProExpiresAt,
                updatedAt: new Date(),
              })
              .where(eq(pgUsers.id, pgUser.id));
          }

          // FOUNDER tier: 90-day entitlements + tick public counter.
          if (resolvedTier === "founder") {
            try {
              await grantFounderTrialEntitlementsPg(pgUser.id);
            } catch (err) {
              logger.error("Failed to grant founder trial entitlements", err);
            }
            try {
              await incrementFounderCounter();
            } catch (err) {
              logger.error("Failed to increment founder counter", err);
            }
          }

          // Create order (Postgres).
          const invoiceNumber = await generateInvoiceNumber();
          const orderAmountCents = session.amount_total || 0;
          const orderAmount = orderAmountCents / 100;
          const orderCurrency = session.currency || "usd";

          await db.insert(pgOrders).values({
            userId: pgUser.id,
            email,
            tier: resolvedTier ?? tier ?? "unknown",
            amountCents: orderAmountCents,
            currency: orderCurrency,
            status: "paid",
            stripeCheckoutSessionId: session.id,
            stripePaymentIntentId: (session.payment_intent as string) || null,
            invoiceNumber,
            paidAt: new Date(),
            metadata: {
              customerName,
              stripeCustomerId: session.customer as string,
              portalProMonths: proMonths,
              deliveryStatus: "pending",
            },
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
          const subUserId = session.metadata?.userId;
          // subUserId from metadata is expected to be the Postgres UUID
          // post-migration. If it's not a UUID, we skip the user update —
          // the downstream portal subscription flow is not wired yet.
          const UUID_RE =
            /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
          if (subUserId && UUID_RE.test(subUserId)) {
            await db
              .update(pgUsers)
              .set({ updatedAt: new Date() })
              .where(eq(pgUsers.id, subUserId));
          }

          const subInvoiceNumber = await generateInvoiceNumber();
          const subAmountCents = session.amount_total || 0;
          const subAmount = subAmountCents / 100;
          const subCurrency = session.currency || "usd";
          const subTier = plan === "pro" ? "portal_pro" : "portal_business";

          await db.insert(pgOrders).values({
            userId: subUserId && UUID_RE.test(subUserId) ? subUserId : null,
            email,
            tier: subTier,
            amountCents: subAmountCents,
            currency: subCurrency,
            status: "paid",
            stripeCheckoutSessionId: session.id,
            stripePaymentIntentId: (session.payment_intent as string) || null,
            invoiceNumber: subInvoiceNumber,
            paidAt: new Date(),
            metadata: {
              stripeCustomerId: session.customer as string,
              stripeSubscriptionId: session.subscription as string,
              plan,
              deliveryStatus: "email_sent",
            },
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
        // Subscription cancellations are tracked on the Mongo user today.
        // Not repointed here (out of scope — portal subscription flow is
        // still Mongo-backed). Log and no-op on Postgres.
        const subscription = event.data.object as Stripe.Subscription;
        logger.info(
          `Stripe subscription.deleted ${subscription.id} — Postgres no-op (Mongo-only flow)`
        );
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
