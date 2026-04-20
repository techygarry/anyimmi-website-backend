import { Request, Response, NextFunction } from "express";
import { stripe } from "../../config/stripe.js";
import { env } from "../../config/env.js";
import { sendResponse } from "../../utils/apiResponse.js";
import { AppError } from "../../utils/apiError.js";
import { getBundlePlans, getBundlePlanByTier, getPortalPlanById } from "../../utils/settingsHelper.js";

export const listBundlePlans = async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const plans = await getBundlePlans();
    const publicPlans = plans
      .filter((p) => p.active)
      .map(({ stripePriceId: _s, ...rest }) => rest);
    sendResponse(res, 200, publicPlans);
  } catch (err) {
    next(err);
  }
};

export const bundleCheckout = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { tier } = req.body;
    const bundlePlan = tier ? await getBundlePlanByTier(tier) : undefined;
    if (!bundlePlan) {
      throw new AppError("Invalid tier", 400);
    }

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      payment_method_types: ["card"],
      line_items: [{ price: bundlePlan.stripePriceId, quantity: 1 }],
      metadata: { tier, portalProMonths: bundlePlan.portalProMonths.toString() },
      success_url: `${env.FRONTEND_PORTAL_URL}/auto-login?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${env.FRONTEND_BUNDLE_URL}/#pricing`,
    });

    sendResponse(res, 200, { url: session.url });
  } catch (err) {
    next(err);
  }
};

export const portalCheckout = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { plan: planId } = req.body;
    const portalPlan = planId ? await getPortalPlanById(planId) : undefined;
    if (!portalPlan) {
      throw new AppError("Invalid plan", 400);
    }

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      payment_method_types: ["card"],
      line_items: [{ price: portalPlan.stripePriceId, quantity: 1 }],
      metadata: { plan: planId, userId: req.user!._id.toString() },
      customer_email: req.user!.email,
      success_url: `${env.FRONTEND_PORTAL_URL}/dashboard?upgraded=true`,
      cancel_url: `${env.FRONTEND_PORTAL_URL}/settings`,
    });

    sendResponse(res, 200, { url: session.url });
  } catch (err) {
    next(err);
  }
};

export const portalCancel = async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user!.subscriptionId) {
      throw new AppError("No active subscription", 400);
    }

    await stripe.subscriptions.cancel(req.user!.subscriptionId);

    req.user!.plan = "free";
    req.user!.subscriptionId = undefined;
    req.user!.subscriptionStatus = "canceled";
    await req.user!.save();

    sendResponse(res, 200, null, "Subscription cancelled");
  } catch (err) {
    next(err);
  }
};
