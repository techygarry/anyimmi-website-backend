/**
 * Postgres-backed repo for the singleton founder_counter row.
 * Drop-in replacement for the old Mongoose helpers so route/controller
 * code can swap the import without behavioural changes.
 */

import { db } from "../../db/client.js";
import { founderCounter } from "../../db/schema/index.js";
import { eq, sql } from "drizzle-orm";

const SINGLETON_ID = 1;

export interface FounderCounterRow {
  current: number;
  target: number;
  active: boolean;
}

/** Always return the singleton row, creating it with defaults if missing. */
export async function getFounderCounter(): Promise<FounderCounterRow> {
  const [existing] = await db
    .select()
    .from(founderCounter)
    .where(eq(founderCounter.id, SINGLETON_ID))
    .limit(1);
  if (existing) {
    return {
      current: existing.current,
      target: existing.target,
      active: existing.active,
    };
  }

  const [row] = await db
    .insert(founderCounter)
    .values({ id: SINGLETON_ID })
    .onConflictDoNothing()
    .returning();

  if (row) {
    return { current: row.current, target: row.target, active: row.active };
  }

  // Lost the race — read again.
  const [after] = await db
    .select()
    .from(founderCounter)
    .where(eq(founderCounter.id, SINGLETON_ID))
    .limit(1);
  return {
    current: after.current,
    target: after.target,
    active: after.active,
  };
}

/** Atomically +1 the current counter (upserting the row if needed). */
export async function incrementFounderCounter(): Promise<void> {
  // Make sure the row exists, then increment.
  await getFounderCounter();
  await db
    .update(founderCounter)
    .set({
      current: sql`${founderCounter.current} + 1`,
      updatedAt: new Date(),
    })
    .where(eq(founderCounter.id, SINGLETON_ID));
}

export async function updateFounderCounter(input: {
  current?: number;
  target?: number;
  active?: boolean;
}): Promise<void> {
  await getFounderCounter();
  const patch: Record<string, unknown> = { updatedAt: new Date() };
  if (input.current !== undefined) patch.current = input.current;
  if (input.target !== undefined) patch.target = input.target;
  if (input.active !== undefined) patch.active = input.active;
  await db
    .update(founderCounter)
    .set(patch)
    .where(eq(founderCounter.id, SINGLETON_ID));
}
