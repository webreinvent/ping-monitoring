import Database from "better-sqlite3";
import { resolve } from "node:path";
import { existsSync, mkdirSync, readdirSync, readFileSync } from "node:fs";
import { info, warn, error } from "../utils/logger";

let dbInstance: Database | null = null;

function getDatabase(): Database {
  if (dbInstance) {
    return dbInstance;
  }

  const dbPath = (process.env.DATABASE_PATH as string) || ".data/lingering.db";

  // Ensure the directory exists
  const fullDbPath = resolve(dbPath);
  const dbDir = fullDbPath.substring(0, fullDbPath.lastIndexOf("/"));
  if (dbDir && !existsSync(dbDir)) {
    mkdirSync(dbDir, { recursive: true });
  }

  // Open SQLite connection with WAL mode
  dbInstance = new Database(fullDbPath);

  // Enable WAL mode for concurrent read/write
  const walResult = dbInstance.pragma("journal_mode = WAL");
  info("WAL mode enabled", { result: walResult });

  // Enable foreign key constraints
  dbInstance.pragma("foreign_keys = ON");
  info("Foreign keys enabled");

  // Recommended pragmas for performance and reliability
  dbInstance.pragma("synchronous = NORMAL");
  info("Pragma applied: synchronous = NORMAL");

  dbInstance.pragma("cache_size = -64000");
  info("Pragma applied: cache_size = -64000 (64MB)");

  dbInstance.pragma("temp_store = MEMORY");
  info("Pragma applied: temp_store = MEMORY");

  dbInstance.pragma("busy_timeout = 5000");
  info("Pragma applied: busy_timeout = 5000");

  dbInstance.pragma("wal_autocheckpoint = 1000");
  info("Pragma applied: wal_autocheckpoint = 1000");

  // Run migrations
  runMigrations(dbInstance);

  return dbInstance;
}

function runMigrations(db: Database.Database): void {
  // Run numbered migration files in order
  const migrationsDir = resolve("schema/migrations");
  if (!existsSync(migrationsDir)) {
    warn("Migrations directory not found, skipping migrations");
    return;
  }

  // Ensure the migrations tracking table exists
  db.exec(
    `CREATE TABLE IF NOT EXISTS migrations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      applied_at TEXT NOT NULL DEFAULT (datetime('now'))
    )`,
  );

  // Get already-applied migrations
  const applied: string[] = db
    .prepare("SELECT name FROM migrations ORDER BY name")
    .all()
    .map((r: { name: string }) => r.name);

  const files = readdirSync(migrationsDir)
    .filter((f) => f.endsWith(".sql"))
    .sort();

  let appliedCount = 0;
  let skippedCount = 0;

  for (const file of files) {
    if (applied.includes(file)) {
      skippedCount++;
      continue;
    }

    try {
      const path = resolve(migrationsDir, file);
      const sql = readFileSync(path, "utf-8");
      db.exec(sql);
      db.prepare("INSERT INTO migrations (name) VALUES (?)").run(file);
      appliedCount++;
      info(`Migration applied: ${file}`);
    } catch (err) {
      error(`Migration failed: ${file}`, {
        error: err instanceof Error ? err.message : String(err),
        file,
      });
      throw err;
    }
  }

  info(
    `Migrations complete: ${appliedCount} applied, ${skippedCount} already applied`,
    {
      applied: appliedCount,
      skipped: skippedCount,
      total: files.length,
    },
  );
}

// Initialize database on plugin load
export default defineNitroPlugin(() => {
  const db = getDatabase();
  // Store on globalThis for use in API routes
  (globalThis as any).__db = db;

  // Return cleanup function for graceful shutdown
  return () => {
    if (dbInstance) {
      try {
        dbInstance.close();
        info("Database connection closed");
      } catch (err) {
        error("Failed to close database connection", {
          error: err instanceof Error ? err.message : String(err),
        });
      } finally {
        dbInstance = null;
      }
    }
  };
});
