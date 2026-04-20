/**
 * Postgres client for the anyimmi backend.
 *
 * Connects to Supabase Postgres (local CLI stack in dev, hosted in prod).
 * The connection URL is driven by env DATABASE_URL.
 *
 * In dev: postgres://postgres:postgres@127.0.0.1:57322/postgres
 * In prod: postgres://postgres.<project>:<pw>@aws-0-ca-central-1.pooler.supabase.com:6543/postgres
 */

import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';
import { env } from '../config/env';
import { logger } from '../utils/logger';

const connectionString =
  process.env.DATABASE_URL ||
  // Default to dossiar-app's local Supabase stack on port 57322 (Path A).
  'postgres://postgres:postgres@127.0.0.1:57322/postgres';

export const sql = postgres(connectionString, {
  max: 10,
  prepare: false, // pgbouncer-friendly
  onnotice: () => {}, // silence NOTICEs
});

export const db = drizzle(sql, { schema });

/** Ping to verify connection at boot. */
export async function pingPostgres(): Promise<boolean> {
  try {
    await sql`SELECT 1`;
    logger.info(`Postgres connected (${connectionString.split('@')[1] || 'local'})`);
    return true;
  } catch (err) {
    logger.error('Postgres connection failed', err);
    return false;
  }
}

/** Close the pool (graceful shutdown). */
export async function closePostgres(): Promise<void> {
  await sql.end({ timeout: 5 });
}

export { schema };
// Suppress unused-import warning for env
void env;
