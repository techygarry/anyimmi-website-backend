/**
 * Postgres-backed repo for the singleton bonus_countdown row.
 * Drop-in replacement for the old Mongoose helpers.
 */

import { db } from "../../db/client.js";
import { bonusCountdown } from "../../db/schema/index.js";
import { eq } from "drizzle-orm";

const SINGLETON_ID = 1;

const DEFAULT_DESCRIPTION =
  "After Sunday midnight, THE FOUNDER drops the 3-month free trial to 30 days, removes the 1-on-1 call, and removes lifetime grandfathering.";

export interface BonusCountdownRow {
  expiresAt: Date;
  bonusDescription: string;
  active: boolean;
}

/**
 * Next Sunday at 23:59:59.999 UTC, relative to `from`.
 * If `from` is already past that Sunday's cutoff, pushes to the following Sunday.
 */
export function nextSundayMidnightUTC(from: Date = new Date()): Date {
  const next = new Date(from.getTime());
  const daysUntilSunday = (7 - next.getUTCDay()) % 7;
  next.setUTCDate(next.getUTCDate() + daysUntilSunday);
  next.setUTCHours(23, 59, 59, 999);
  if (next.getTime() <= from.getTime()) {
    next.setUTCDate(next.getUTCDate() + 7);
  }
  return next;
}

export async function getBonusCountdown(): Promise<BonusCountdownRow> {
  const [existing] = await db
    .select()
    .from(bonusCountdown)
    .where(eq(bonusCountdown.id, SINGLETON_ID))
    .limit(1);
  if (existing) {
    return {
      expiresAt: existing.expiresAt,
      bonusDescription: existing.bonusDescription,
      active: existing.active,
    };
  }

  const [row] = await db
    .insert(bonusCountdown)
    .values({
      id: SINGLETON_ID,
      expiresAt: nextSundayMidnightUTC(),
      bonusDescription: DEFAULT_DESCRIPTION,
      active: true,
    })
    .onConflictDoNothing()
    .returning();

  if (row) {
    return {
      expiresAt: row.expiresAt,
      bonusDescription: row.bonusDescription,
      active: row.active,
    };
  }

  const [after] = await db
    .select()
    .from(bonusCountdown)
    .where(eq(bonusCountdown.id, SINGLETON_ID))
    .limit(1);
  return {
    expiresAt: after.expiresAt,
    bonusDescription: after.bonusDescription,
    active: after.active,
  };
}

export async function updateBonusCountdown(input: {
  expiresAt?: Date;
  bonusDescription?: string;
  active?: boolean;
}): Promise<void> {
  await getBonusCountdown();
  const patch: Record<string, unknown> = { updatedAt: new Date() };
  if (input.expiresAt !== undefined) patch.expiresAt = input.expiresAt;
  if (input.bonusDescription !== undefined)
    patch.bonusDescription = input.bonusDescription;
  if (input.active !== undefined) patch.active = input.active;
  await db
    .update(bonusCountdown)
    .set(patch)
    .where(eq(bonusCountdown.id, SINGLETON_ID));
}
