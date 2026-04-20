import { Router } from "express";
import { authenticate } from "../../middleware/authenticate.js";
import { listBundlePlans, bundleCheckout, portalCheckout, portalCancel } from "./payments.controller.js";

const router = Router();

router.get("/bundle-plans", listBundlePlans);
router.post("/bundle-checkout", bundleCheckout);
router.post("/portal-checkout", authenticate, portalCheckout);
router.post("/portal-cancel", authenticate, portalCancel);

export default router;
