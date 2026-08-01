import type { Database } from "better-sqlite3";

/**
 * Get the SQLite database instance.
 * The database is initialized in server/plugins/database.ts and stored on globalThis.
 */
export function getDb(): Database {
  const db = (globalThis as any).__db as Database | undefined;
  if (!db) {
    throw new Error(
      "Database not initialized. Ensure database plugin is loaded.",
    );
  }
  return db;
}
