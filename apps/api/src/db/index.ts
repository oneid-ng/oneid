/**
 * db/index.ts — Drizzle ORM singleton + re-exports.
 *
 * Lazy initialisation: throws only when getDb() is called, not at import time.
 * This lets tests import without a live database.
 */

import { drizzle, type PostgresJsDatabase } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema.js";

export * from "./schema.js";

type Db = PostgresJsDatabase<typeof schema>;

let _db: Db | undefined;
let _client: ReturnType<typeof postgres> | undefined;

/**
 * Return the singleton Drizzle database instance.
 * Initialises on first call using DATABASE_URL from the environment.
 */
export function getDb(): Db {
  if (_db) return _db;

  const url = process.env["DATABASE_URL"];
  if (!url) {
    throw new Error("DATABASE_URL environment variable is required but not set.");
  }

  _client = postgres(url, { max: 10 });
  _db = drizzle(_client, { schema });
  return _db;
}

/**
 * Close the database connection pool.
 * Call this during graceful shutdown.
 */
export async function closeDb(): Promise<void> {
  if (_client) {
    await _client.end();
    _client = undefined;
    _db = undefined;
  }
}
