// Seed fake data for milestone-02 dashboard validation.
// Inserts clients, monitors, and 24h of ping samples into the
// running dashboard's SQLite database. Idempotent: clears
// seeded rows (by slug prefix) before inserting.

import Database from "better-sqlite3";
import { resolve } from "node:path";
import { existsSync, mkdirSync } from "node:fs";

const DB_PATH = resolve(".data/lingering.db");
const SCHEMA_DIR = resolve("schema/migrations");

if (!existsSync(DB_PATH)) {
  console.error(`DB not found at ${DB_PATH} — start the dev server first.`);
  process.exit(1);
}

const db = new Database(DB_PATH);
db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");

// --- Wipe previously seeded clients (matched by slug prefix) ---
const seededSlugs = [
  "acme-laptop",
  "acme-router",
  "globex-server",
  "globex-printer",
  "initech-desktop",
];
const deleteStmt = db.prepare(`DELETE FROM clients WHERE slug = ?`);
for (const slug of seededSlugs) deleteStmt.run(slug);

// --- Insert clients ---
const now = Date.now();
const insertClient = db.prepare(`
  INSERT INTO clients (slug, name, username, hostname, mac_address,
    sync_enabled, sync_interval_min, backend_url, last_synced_at_ms,
    created_at, updated_at)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`);

const clientDefs = [
  { slug: "acme-laptop",        name: "Alice's MacBook Pro",  username: "alice",   hostname: "alice-mbp",   mac: "aa:bb:cc:00:00:01", sync: 1, interval: 5,  url: "https://api.acme.example",        lastSync: now - 60_000 },
  { slug: "acme-router",        name: "Acme Office Router",   username: "root",    hostname: "acme-fw01",   mac: "aa:bb:cc:00:00:02", sync: 1, interval: 15, url: "https://api.acme.example",        lastSync: now - 5 * 60_000 },
  { slug: "globex-server",      name: "Globex API Server",    username: "deploy",  hostname: "globex-api-1",mac: "aa:bb:cc:00:00:03", sync: 1, interval: 5,  url: "https://api.globex.example",      lastSync: now - 90_000 },
  { slug: "globex-printer",     name: "Globex Office Printer",username: "svc",     hostname: "globex-ptr",  mac: "aa:bb:cc:00:00:04", sync: 0, interval: 30, url: "",                                lastSync: null },
  { slug: "initech-desktop",    name: "Bill's Desktop",       username: "bill",    hostname: "bill-pc",     mac: "aa:bb:cc:00:00:05", sync: 1, interval: 10, url: "https://api.initech.example",     lastSync: now - 3 * 60_000 },
];

const clientIds = {};
for (const c of clientDefs) {
  const r = insertClient.run(
    c.slug, c.name, c.username, c.hostname, c.mac,
    c.sync, c.interval, c.url, c.lastSync, now, now,
  );
  clientIds[c.slug] = r.lastInsertRowid;
}

// --- Insert monitors ---
// Each monitor is described by (slug, host, name, qualityProfile)
// qualityProfile controls: base latency, jitter, loss rate, outage windows
const monitorDefs = [
  // Acme laptop
  { slug: "acme-laptop",     host: "1.1.1.1",                name: "Cloudflare DNS",  profile: "stable"   },
  { slug: "acme-laptop",     host: "8.8.8.8",                name: "Google DNS",      profile: "stable"   },
  { slug: "acme-laptop",     host: "github.com",             name: "GitHub",          profile: "degraded" },
  // Acme router
  { slug: "acme-router",     host: "208.67.222.222",         name: "OpenDNS",         profile: "stable"   },
  { slug: "acme-router",     host: "api.acme.example",       name: "Acme API",        profile: "stable"   },
  // Globex server
  { slug: "globex-server",   host: "api.globex.example",     name: "Globex API (self)", profile: "veryGood"},
  { slug: "globex-server",   host: "s3.amazonaws.com",       name: "AWS S3",          profile: "degraded" },
  { slug: "globex-server",   host: "10.0.0.1",               name: "Internal DB",     profile: "flaky"    },
  // Globex printer (sync disabled — older history)
  { slug: "globex-printer",  host: "192.168.1.50",           name: "Office Printer",  profile: "unstable" },
  // Initech desktop
  { slug: "initech-desktop", host: "1.1.1.1",                name: "Cloudflare",      profile: "stable"   },
  { slug: "initech-desktop", host: "api.initech.example",    name: "Initech API",     profile: "outage"   },
];

const insertMonitor = db.prepare(`
  INSERT INTO monitors (client_id, target_host, target_name, quality_state,
    state_since_ms, last_seen_ms, last_status, last_latency_ms,
    quality_state_updated_at, created_at, updated_at)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`);

const monitorIds = [];
const nowMs = now;
const HOURS = 24;
const STEP_MS = 30_000; // 30s sampling → 2880 samples per monitor over 24h

const profile = {
  stable:   { base: 18,  jitter: 4,  lossRate: 0.000, statusCycle: ["success"] },
  veryGood: { base: 25,  jitter: 6,  lossRate: 0.000, statusCycle: ["success"] },
  degraded: { base: 95,  jitter: 30, lossRate: 0.04,  statusCycle: ["success","success","success","timeout"] },
  flaky:    { base: 60,  jitter: 80, lossRate: 0.10,  statusCycle: ["success","success","timeout","success"] },
  unstable: { base: 140, jitter: 60, lossRate: 0.25,  statusCycle: ["success","timeout","timeout"] },
  outage:   { base: 200, jitter: 50, lossRate: 0.60,  statusCycle: ["timeout","timeout"] },
};

let monitorCounter = 0;
for (const m of monitorDefs) {
  const prof = profile[m.profile];
  // Compute quality_state from profile
  let quality;
  if (m.profile === "stable") quality = "veryHigh";
  else if (m.profile === "veryGood") quality = "high";
  else if (m.profile === "degraded") quality = "medium";
  else if (m.profile === "flaky") quality = "low";
  else if (m.profile === "unstable") quality = "unstable";
  else quality = "unstable";

  const start = nowMs - HOURS * 3600_000;
  const r = insertMonitor.run(
    clientIds[m.slug],
    m.host,
    m.name,
    quality,
    nowMs - 30 * 60_000,
    nowMs,
    "success",
    prof.base,
    nowMs,
    start,
    nowMs,
  );
  monitorIds.push({ id: r.lastInsertRowid, profile: m.profile });
  monitorCounter++;
}

console.log(`Inserted ${clientDefs.length} clients and ${monitorCounter} monitors.`);

// --- Insert ping samples (24h, every 30s per monitor) ---
const insertSample = db.prepare(`
  INSERT OR IGNORE INTO ping_samples
    (monitor_id, timestamp_ms, latency_ms, status, resolved_address,
     error, created_at)
  VALUES (?, ?, ?, ?, ?, ?, ?)
`);

const insertRollup = db.prepare(`
  INSERT OR IGNORE INTO minute_rollups
    (monitor_id, timestamp_ms, sample_count, success_count, failure_count,
     avg_latency, min_latency, max_latency, p95_latency, created_at)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`);

const rollupAgg = new Map(); // key = "monitorId:bucketMs" → { count, success, latencies[] }
let sampleCount = 0;

const start = nowMs - HOURS * 3600_000;
for (let t = start; t <= nowMs; t += STEP_MS) {
  for (const mon of monitorIds) {
    const prof = profile[mon.profile];
    // Deterministic pseudo-random per monitor+timestamp
    const seed = (mon.id * 1000003 + Math.floor(t / STEP_MS)) >>> 0;
    const r1 = (seed % 1000) / 1000;
    const r2 = ((seed * 7) % 1000) / 1000;

    let status;
    if (r1 < prof.lossRate) {
      status = r1 < prof.lossRate * 0.3 ? "timeout" : "error";
    } else {
      status = "success";
    }
    const latency = status === "success"
      ? Math.max(1, prof.base + (r2 - 0.5) * 2 * prof.jitter)
      : null;

    const resolved = status === "success" ? `${mon.profile}.seed.example` : null;
    const err = status !== "success" ? (status === "timeout" ? "Request timeout" : "Host unreachable") : null;

    try {
      insertSample.run(mon.id, t, latency, status, resolved, err, nowMs);
      sampleCount++;
    } catch (e) { /* unique constraint — ignore */ }

    // Rollup bucket (1 minute)
    const bucket = Math.floor(t / 60_000) * 60_000;
    const k = `${mon.id}:${bucket}`;
    let agg = rollupAgg.get(k);
    if (!agg) { agg = { count: 0, success: 0, lats: [] }; rollupAgg.set(k, agg); }
    agg.count++;
    if (status === "success") {
      agg.success++;
      if (latency != null) agg.lats.push(latency);
    }
  }
}

// Write rollups
let rollupCount = 0;
for (const [k, agg] of rollupAgg) {
  const [monIdStr, bucketStr] = k.split(":");
  const monId = Number(monIdStr);
  const bucket = Number(bucketStr);
  const fail = agg.count - agg.success;
  const sortedLats = agg.lats.slice().sort((a, b) => a - b);
  const sum = agg.lats.reduce((s, v) => s + v, 0);
  const avg = agg.lats.length ? sum / agg.lats.length : null;
  const min = agg.lats.length ? sortedLats[0] : null;
  const max = agg.lats.length ? sortedLats[sortedLats.length - 1] : null;
  const p95 = agg.lats.length ? sortedLats[Math.floor(sortedLats.length * 0.95)] : null;
  insertRollup.run(monId, bucket, agg.count, agg.success, fail, avg, min, max, p95, nowMs);
  rollupCount++;
}

console.log(`Inserted ${sampleCount} ping samples and ${rollupCount} minute rollups.`);
db.close();
console.log("Seed complete.");
