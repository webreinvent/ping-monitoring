import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { getDb } from "../utils/db";
import { info } from "../utils/logger";

// Cache the version — package.json doesn't change at runtime
const packageJsonPath = resolve(process.cwd(), "package.json");
const pkgVersion = (() => {
  try {
    const pkg = JSON.parse(readFileSync(packageJsonPath, "utf-8")) as {
      version?: string;
    };
    return pkg.version || "0.0.0";
  } catch {
    return "0.0.0";
  }
})();

export default defineEventHandler(async () => {
  try {
    // Check database connectivity
    let dbStatus: "ok" | "error" = "ok";
    try {
      const db = getDb();
      db.prepare("SELECT 1").get();
    } catch {
      dbStatus = "error";
    }

    info("Health check requested", { dbStatus });

    return {
      status: "ok",
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      version: pkgVersion,
      database: dbStatus,
    };
  } catch (err) {
    return {
      status: "error",
      timestamp: new Date().toISOString(),
      message: err instanceof Error ? err.message : "Unknown error",
    };
  }
});
