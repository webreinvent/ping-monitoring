import Database from "better-sqlite3";
import { resolve } from "node:path";
import { existsSync, mkdirSync, readdirSync, readFileSync } from "node:fs";

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
  dbInstance.pragma("journal_mode = WAL");

  // Enable foreign key constraints
  dbInstance.pragma("foreign_keys = ON");

  // Run migrations
  runMigrations(dbInstance);

  return dbInstance;
}

function runMigrations(db: Database.Database): void {
  // Run numbered migration files in order
  const migrationsDir = resolve("schema/migrations");
  if (!existsSync(migrationsDir)) {
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

  for (const file of files) {
    if (applied.includes(file)) {
      continue;
    }

    try {
      const path = resolve(migrationsDir, file);
      const sql = readFileSync(path, "utf-8");
      db.exec(sql);
      db.prepare("INSERT INTO migrations (name) VALUES (?)").run(file);
    } catch (err) {
      console.error(
        `Migration "${file}" failed: ${err instanceof Error ? err.message : err}`,
      );
      throw err;
    }
  }
}

// Initialize database on plugin load
export default defineNitroPlugin(() => {
  const db = getDatabase();
  // Store on globalThis for use in API routes
  (globalThis as any).__db = db;
});
