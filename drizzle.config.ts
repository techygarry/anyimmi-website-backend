import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  schema: './src/db/schema/index.ts',
  out: './src/db/migrations',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DATABASE_URL || 'postgres://postgres:postgres@127.0.0.1:57322/postgres',
  },
  schemaFilter: ['anyimmi'],
  verbose: true,
  strict: true,
});
