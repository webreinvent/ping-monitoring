import type { Database } from "better-sqlite3";

// Extend globalThis with the typed database instance
declare global {
  // eslint-disable-next-line no-var -- globalThis augmentation
  var __db: Database | undefined;
}

/**
 * Get the SQLite database instance.
 * The database is initialized in server/plugins/database.ts and stored on globalThis.
 */
export function getDb(): Database {
  const db = globalThis.__db;
  if (!db) {
    throw new Error(
      "Database not initialized. Ensure database plugin is loaded.",
    );
  }
  return db;
}
