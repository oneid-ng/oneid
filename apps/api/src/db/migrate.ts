/**
 * db/migrate.ts — Run Drizzle migrations against the configured database.
 *
 * Idempotent: drizzle-kit migrations use a journal table and skip already-
 * applied migrations, so this script is safe to run multiple times.
 *
 * Usage: node --import tsx/esm src/db/migrate.ts
 *        pnpm db:migrate
 */

import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = fileURLToPath(new URL(".", import.meta.url));

const url = process.env["DATABASE_URL"];
if (!url) {
  console.error("ERROR: DATABASE_URL environment variable is not set.");
  process.exit(1);
}

const client = postgres(url, { max: 1 });
const db = drizzle(client);

const migrationsFolder = resolve(__dirname, "migrations");

try {
  console.warn(`Running migrations from: ${migrationsFolder}`);
  await migrate(db, { migrationsFolder });
  console.warn("Migration complete.");
  await client.end();
  process.exit(0);
} catch (err) {
  console.error("Migration failed:", err);
  await client.end().catch(() => {});
  process.exit(1);
}
