import "dotenv/config";
import mongoose from "mongoose";
import { env } from "../config/env.js";
import { Category } from "../modules/assets/category.model.js";

/**
 * One-time, idempotent migration.
 *
 * Finds the existing bonus category (variants of "A Million Dollar Bonus" /
 * "Million Dollar Vault") and marks it `isLocked: true, unlockTier: "founder"`.
 *
 * If no matching category exists, creates one at the top of the list.
 *
 * Safe to run multiple times — only updates/creates if state differs.
 */
async function run() {
  await mongoose.connect(env.MONGODB_URI);
  console.log("Connected to MongoDB");

  // Case-insensitive match on either "million dollar bonus" or "million dollar vault"
  const existing = await Category.findOne({
    $or: [
      { name: { $regex: /million\s+dollar\s+(bonus|vault)/i } },
      { slug: { $regex: /million[-_\s]?dollar[-_\s]?(bonus|vault)/i } },
    ],
  });

  if (existing) {
    let changed = false;
    if (existing.isLocked !== true) {
      existing.isLocked = true;
      changed = true;
    }
    if (existing.unlockTier !== "founder") {
      existing.unlockTier = "founder";
      changed = true;
    }
    if (changed) {
      await existing.save();
      console.log(
        `Updated existing category "${existing.name}" (slug=${existing.slug}) -> isLocked=true, unlockTier=founder`
      );
    } else {
      console.log(
        `Category "${existing.name}" already locked to founder tier — no changes`
      );
    }
  } else {
    // Place it above everything existing by taking min(sortOrder) - 1 (or 0).
    const top = await Category.findOne().sort({ sortOrder: 1 }).select("sortOrder");
    const sortOrder = top?.sortOrder !== undefined ? Math.min(0, top.sortOrder - 1) : 0;
    const created = await Category.create({
      name: "The Million Dollar Vault",
      slug: "million-dollar-vault",
      description:
        "The assets that took us 8 years and $1M+ to figure out. Locked. You only get them at THE FOUNDER tier.",
      isLocked: true,
      unlockTier: "founder",
      sortOrder,
      features: [],
      previewImages: [],
      useCases: [],
      assetCount: 0,
    });
    console.log(
      `Created new category "${created.name}" (slug=${created.slug}, sortOrder=${sortOrder})`
    );
  }

  await mongoose.disconnect();
  console.log("Done.");
}

run().catch((err) => {
  console.error("Migration failed:", err);
  process.exit(1);
});
