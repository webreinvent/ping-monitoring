# LNPM Cloud Dashboard — Decisions Made

> Saved: 2026-08-06
> Tasks: M1-T4 (health check), M1-T5 (client identity), M1-T7 (monitors list API), M1-T8 (monitor history API), M1-T9 (WebSocket live broadcast), M1-T12 (rate limiting), M2-T2 (sidebar), M2-T3 (all-monitors chart), M2-T4 (monitor detail view), M2-T6 (client settings page)

## Technology Stack Decisions

### Nuxt 4 with Nitro Server (M1-T1)
- **Decision:** Use Nuxt 4 + Nitro server for the cloud dashboard backend
- **Rationale:** Leverages existing Vue 3 frontend skills, provides built-in API routing, WebSocket support, and server plugins
- **Key config:** `nitro.serverAssets` for server-only files, `@nuxt/nitro-server` preset for persistent Node.js runtime (not serverless)
- **Impact:** All API routes follow Nitro conventions (`server/api/*.get.ts`)

### SQLite with better-sqlite3 (M1-T2)
- **Decision:** Use SQLite via `better-sqlite3` (synchronous Node.js binding)
- **Rationale:** Simple deployment (single file database), WAL mode for concurrent reads, no external database server needed
- **Key config:** WAL mode enabled, database path configurable via `DATABASE_PATH` env var (default: `.data/lingering.db`)
- **Impact:** Database plugin runs migrations on startup, singleton pattern for connection management

## Architecture Decisions

### Health Check Endpoint Design (M1-T4 / F1 + F14)
- **Decision:** Single endpoint serving both basic health (F1) and extended metrics (F14)
- **Rationale:** External monitoring services (Uptime Robot, Pingdom) need a simple status check; internal dashboards need detailed metrics. One endpoint serves both.
- **Design:** Public access (no authentication), returns 200 with JSON containing both basic and extended fields
- **Error handling:** Returns `{ status: "error", message }` on any failure — the absence of a response IS the failure signal

### Database Connectivity Probe
- **Decision:** Include `SELECT 1` probe in health check to verify database connectivity before gathering metrics
- **Rationale:** Distinguishes between "server is up but DB is down" vs "server is up and healthy"
- **Implementation:** Internal `dbStatus` variable logged but not exposed in response (status is always "ok" if endpoint responds per spec)

### Version Caching at Module Load
- **Decision:** Cache `package.json` version at module load time using IIFE
- **Rationale:** `package.json` doesn't change at runtime; reading file on every request is wasteful
- **Impact:** Eliminates filesystem I/O on every health check call

### Separate getExtendedMetrics() Function
- **Decision:** Extract extended metrics (F14) into a separate `getExtendedMetrics()` function
- **Rationale:** Separation of concerns — basic health probe is lightweight, extended metrics are more expensive but still negligible
- **Impact:** Clean structure, easy to extend or optimize independently

### Uptime Rounding to 2 Decimal Places
- **Decision:** Round `process.uptime()` to 2 decimal places using `Math.round(uptime * 100) / 100`
- **Rationale:** Spec requires 2 decimal places; avoids floating point precision noise in responses

### No Authentication for Health Endpoint
- **Decision:** Health endpoint is publicly accessible with no authentication
- **Rationale:** External monitoring services need to reach the endpoint without credentials; health check responses contain no sensitive data (counts and timestamps only)

## Implementation Decisions

### Error Response Shape
- **Decision:** Error responses return `{ status: "error", timestamp, message }` — a minimal structured response
- **Rationale:** Consistent with success response shape (always contains `status` and `timestamp`), allows callers to distinguish error from success programmatically

### statSync for File Size (Synchronous)
- **Decision:** Use synchronous `fs.statSync()` for database file size
- **Rationale:** Health checks are infrequent (1-5 minutes by external monitors); synchronous call is simpler and negligible overhead
- **Trade-off:** Accepts minor blocking on single-file stat for simplicity

### Database Path Resolution
- **Decision:** Resolve relative `DATABASE_PATH` to absolute path using `path.resolve()`
- **Rationale:** External monitors and dashboards need the full path; relative paths are ambiguous in responses
- **Default:** `.data/lingering.db` when `DATABASE_PATH` is not set

## API Contract Decisions

### last_ingest_time as null for empty database
- **Decision:** Return `null` (not empty string, not 0) when no samples exist
- **Rationale:** Semantically correct — "no ingest time" maps to `null`; callers can distinguish between "never ingested" and "ingested at epoch"

### Response field types
- **Decision:** All counts are numbers (0 for empty), `last_ingest_time` is `string | null`, `uptime` is number (2 decimal places)
- **Rationale:** Matches F14 API contract exactly; consistent with TypeScript interface `HealthResponse`

## Client Identity Decisions (M1-T5 / F2)

### Slug Generation Algorithm
- **Decision:** Use `<username>-<hostname>-<last-10-hex-chars-of-MAC>` as slug format
- **Rationale:** Deterministic (same inputs always produce same slug), URL-safe, human-readable, and collision-resistant (MAC address provides entropy)
- **Impact:** Slug is computed once on ingest; all subsequent client lookups use this deterministic value

### ClientRow vs ClientResponse Type Separation
- **Decision:** Maintain separate TypeScript interfaces for DB rows (`ClientRow`) and API responses (`ClientResponse`)
- **Rationale:** Prevents leaking internal DB fields (sync settings, backend URL, epoch timestamps) to API consumers
- **Impact:** `toClientResponse()` is the sole serialization function — single source of truth for API shape

### Upsert via INSERT OR IGNORE with ON CONFLICT
- **Decision:** Use SQLite's `INSERT ... ON CONFLICT(slug) DO UPDATE SET` for client registration
- **Rationale:** Single SQL statement handles both new and existing clients; no race conditions; no application-level existence checks needed
- **Impact:** Idempotent client registration — safe to call multiple times with same inputs

### Default Name: username@hostname
- **Decision:** Auto-generate client name as `username@hostname` on first registration
- **Rationale:** Provides meaningful default without requiring client-side input; follows convention of "who@where"
- **Impact:** Can be overridden later via `PUT /api/clients/:slug/name` (F11)

### Name Validation: 1-100 characters after trim
- **Decision:** Trim whitespace and reject empty strings, whitespace-only strings, or strings >100 chars
- **Rationale:** Prevents database abuse; 100 chars is generous for display names but prevents pathological inputs
- **Impact:** Returns 400 Bad Request with descriptive error message

### Timestamps: ISO 8601 strings in API, epoch-ms in DB
- **Decision:** Store timestamps as epoch milliseconds in DB (better-sqlite3 stores as numbers), convert to ISO 8601 strings in API responses
- **Rationale:** Epoch-ms is efficient for storage and comparison; ISO 8601 is human-readable and matches API contract
- **Impact:** `toClientResponse()` handles the conversion transparently

## Monitors List Decisions (M1-T7 / F5)

### Single SQL Query with CTE (No N+1)
- **Decision:** Use a single SQL query with CTE + `ROW_NUMBER()` to fetch monitors with latest state, rather than a separate query per monitor
- **Rationale:** Eliminates N+1 query problem; single round-trip to SQLite is efficient and simple
- **Impact:** `getAllMonitorsWithLatestState()` returns complete data in one call

### LEFT JOIN for monitors with no samples
- **Decision:** Use LEFT JOIN (not INNER JOIN) to latest_samples so monitors with zero ping samples still appear in results
- **Rationale:** New monitors should appear in the list immediately after creation, not only after receiving their first ping
- **Impact:** Monitors with no samples have null `status`, `latencyMs`, and `lastSeenMs`

### COALESCE for sort ordering of null timestamps
- **Decision:** Use `COALESCE(ls.timestamp_ms, 0) DESC` so monitors with no samples sort to the end
- **Rationale:** Null timestamps would sort unpredictably in DESC order; using 0 as fallback consistently pushes them last
- **Impact:** Deterministic, intuitive sort order

### Status mapping: success→up, timeout/error→down
- **Decision:** Map DB-level status values (`success`, `timeout`, `error`) to API-level status (`up`, `down`, `null`)
- **Rationale:** API consumers expect simple status values; `success`→`up` is intuitive, grouping `timeout` and `error` as `down` is semantically correct
- **Impact:** Private `mapSampleStatus()` function encapsulates the mapping logic

### Quality state: warmingUp→unknown, pass-through for others
- **Decision:** Map `warmingUp` to `unknown` and pass through `good`, `degraded`, `poor` as-is
- **Rationale:** `warmingUp` is an internal DB state; the API contract uses `unknown` for monitors without enough data to classify
- **Impact:** Private `mapQualityState()` function; no leak of internal state names

### targetName fallback to targetHost
- **Decision:** When `target_name` is NULL in the DB, fall back to `target_host` for the `targetName` field
- **Rationale:** Ensures the API always returns a meaningful display name; monitors created before a name was set should still show something useful
- **Impact:** `targetName: row.target_name ?? row.target_host` in the mapping layer

## Monitor History API Decisions (M1-T8 / F6)

### Approach A: Raw Aggregation (No Materialized Rollups)
- **Decision:** Aggregate directly from `ping_samples` table using SQL `GROUP BY` on truncated timestamps, rather than maintaining a separate `minute_rollups` table
- **Rationale:** Simpler (no new migration, no background sync job), sufficient for MVP load. Composite index (`idx_ping_monitor_time`) makes queries efficient for typical time windows (1h-24h)
- **Impact:** All history queries are real-time aggregation; no pre-computed data to keep in sync. Deferred optimization: materialized rollups in F12/M2

### Quality Classifier: Server-side Threshold-based Classification
- **Decision:** Classify quality state (warmingUp, low, medium, high, veryHigh, unstable, disconnected) server-side in the history utility, using F6 spec thresholds
- **Rationale:** Frontend chart needs quality state per bucket for coloring; computing server-side avoids sending raw data just for classification
- **Impact:** `classifyPoint()` is a pure function; `computeQualityIntervals()` merges consecutive same-state buckets into intervals

### Down-sampling: Bucket Size Adjustment (Not Post-hoc)
- **Decision:** Down-sample by increasing SQL bucket size (not by post-hoc sampling of results), using `calculateBucketSize()` to find optimal bucket
- **Rationale:** Cleaner — the SQL query itself returns the right number of buckets. Post-hoc sampling would require re-aggregating arbitrary subsets
- **Impact:** `calculateBucketSize(fromMs, toMs, maxPoints)` tries bucket sizes [1m, 5m, 15m, 30m, 1h] until point count ≤ maxPoints

### Default Time Window: Last 1 Hour
- **Decision:** When no `fromMs`/`toMs` params provided, default to last 1 hour (`toMs = now`, `fromMs = now - 3600000`)
- **Rationale:** Balanced default — recent enough to be relevant, wide enough to show meaningful patterns
- **Impact:** Route handler computes defaults: `const toMs = Date.now(); const fromMs = toMs - 3600000;`

### 404/400 Error Handling for History Endpoint
- **Decision:** Return 404 for non-existent monitor (before querying samples), 400 for invalid params (fromMs > toMs)
- **Rationale:** Fail fast with clear error codes; 404 before expensive query prevents wasted computation
- **Impact:** Monitor existence check via `db.prepare("SELECT id FROM monitors WHERE id = ?").get()` before history aggregation

### p95 Approximation via Bucket Averages
- **Decision:** Compute p95 from per-bucket average latencies (not individual samples), documented as approximation
- **Rationale:** Acceptable for MVP — querying all individual samples would be expensive; bucket averages are a reasonable proxy
- **Impact:** p95 may differ slightly from true p95 of all samples, but is consistent and performant. Can be improved in future with percentile queries.

### F6 Types: Separate from Desktop App Types
- **Decision:** Use F6 API contract types (from `api-design.md`) for dashboard, not desktop app types from `src/types.ts`
- **Rationale:** Dashboard has its own API contract; QualityReason and QualityState enums differ between desktop and dashboard
- **Impact:** F6 types in `shared/types.ts` are dashboard-specific: `QualityReason` uses F6 contract values (`packetLoss`, `highLatency`, `highJitter`, `insufficientSamples`), not desktop values

## WebSocket Live Broadcast Decisions (M1-T9 / F7)

### Subscription-per-monitor model (not global broadcast)
- **Decision:** Each WebSocket client subscribes to specific monitor_ids (not a global broadcast to all monitors)
- **Rationale:** Scales better (only sends data clients actually want), respects client interest, and matches F7 spec
- **Impact:** `Map<number, Set<WebSocketType>>` subscription map; clients must explicitly subscribe/unsubscribe per monitor

### Snapshot on subscribe (last 100 samples)
- **Decision:** Send last 100 samples immediately after subscription acknowledgment
- **Rationale:** UI has historical context without needing a separate API call to the history endpoint; provides immediate chart data
- **Impact:** Two queries on subscribe: one for monitor state, one for last 100 samples. SNAPSHOT_SIZE constant (100) is configurable.

### Broadcast from ingest endpoint (not separate broadcast endpoint)
- **Decision:** The ingest endpoint (`POST /api/ping/ingest`) triggers WebSocket broadcast after successful DB insert
- **Rationale:** Tight coupling — the ingest endpoint already has the sample data; no need for a second code path or polling
- **Impact:** `broadcastSample()` is exported from `server/ws/ping.ts` and imported by `server/api/ping/ingest.post.ts`

### JSON message protocol with type discriminator
- **Decision:** All WebSocket messages are JSON with a `type` field for routing
- **Rationale:** Simple, human-readable, matches F7 spec exactly, and easy to extend with new message types
- **Impact:** 7 message types: `subscribe`, `unsubscribe`, `subscribed`, `unsubscribed`, `snapshot`, `sample`, `error`

### Monitor existence check before subscribe
- **Decision:** Validate that the monitor exists before adding to subscription map
- **Rationale:** Prevents subscribing to non-existent monitors; provides clear error feedback
- **Impact:** `SELECT id FROM monitors WHERE id = ?` check before subscription; returns `error` message if not found

### No WebSocket-level authentication
- **Decision:** Current implementation assumes same-origin or token-based auth at HTTP level (Nuxt proxy handles this)
- **Rationale:** MVP doesn't require WebSocket-specific auth; the HTTP connection is already authenticated
- **Impact:** Future enhancement may add per-message auth or token exchange on connect

## Quality Classifier Decisions (M1-T10)

### 7-State Classification with First-Match-Wins
- **Decision:** 7 quality states: `veryHigh`, `high`, `medium`, `low`, `unstable`, `disconnected`, `warmingUp`
- **Rationale:** Simple ordered-if chain, easy to reason about. `unstable` checked before `veryHigh` so high-variance connections aren't misclassified as excellent
- **Thresholds:** 5-min window, 10 min samples, CV > 0.5 for unstable, 0% packet_loss + <50ms for veryHigh, 0% + <150ms for high, ≤10% + ≤300ms for medium

### Disconnected Detection with Time Bounds
- **Decision:** Disconnected = no samples in 5-min window AND last sample 5-60 min ago. If last sample >1 hour ago → `warmingUp`
- **Rationale:** Without the 1-hour cap, old inactive monitors would show as `disconnected` instead of `warmingUp`

### Post-Ingest After Transaction (Best-Effort)
- **Decision:** Classification runs after transaction commits. Failure is logged but never breaks ingest
- **Rationale:** Ingest is critical path; classification is metadata. Running after commit ensures classifier sees new data

### Background Sweep: Recent Monitors Only
- **Decision:** Only classify monitors with samples in last 10 minutes (2× the 5-min window)
- **Rationale:** Avoids unnecessary reads on inactive monitors

### Migration 006: Legacy State Mapping
- **Decision:** Map `warmingUp`→`disconnected`, `good`→`veryHigh`, `degraded`→`medium`, `poor`→`low`
- **Rationale:** Existing monitors have pre-F12 states; migration ensures correct display

## Rate Limiting Decisions (M1-T12 / F13)

### In-memory LRU sliding window (no Redis)
- **Decision:** Use in-memory `Map<string, RateLimitEntry>` with LRU eviction, not Redis or any external store
- **Rationale:** MVP doesn't require distributed rate limiting; the dashboard is single-instance (SQLite backend). Adding Redis would be over-engineering for the current scope.
- **Impact:** Each process has independent rate limit state. Documented as a known limitation; Redis can be added later if multi-process deployment is needed.

### Separate utility + middleware layers
- **Decision:** Rate limiter logic in `server/utils/rate-limiter.ts` (pure functions), middleware in `server/middleware/rate-limit.ts` (HTTP integration)
- **Rationale:** Clean separation of concerns — the utility is testable without HTTP context, middleware handles request/response only
- **Impact:** `checkRateLimit()` and `getRateLimitConfig()` are pure; middleware composes them with `getRequestIP()`, `setHeader()`, `setResponseStatus()`.

### Per-IP tracking with xForwardedFor support
- **Decision:** Use `getRequestIP(event, { xForwardedFor: true })` for IP resolution
- **Rationale:** The dashboard may sit behind a reverse proxy (Nginx, Cloudflare); `xForwardedFor` support ensures correct client IP in all deployment scenarios
- **Impact:** Falls back to allowing the request through if IP cannot be determined (graceful degradation, not a hard block).

### Different limits for ingest vs other endpoints
- **Decision:** Ingest endpoint gets 100 req/min; all other API endpoints get 60 req/min
- **Rationale:** The ingest endpoint handles high-frequency ping data from LNPM clients (up to 1 ping/minute per monitor); other endpoints are dashboard UI calls (lower frequency)
- **Impact:** `getRateLimitConfig(isIngest)` selects the appropriate limit based on URL path prefix (`/api/ping/ingest`).

### 429 response shape: `{ error: "rate_limit_exceeded", retryAfter: N }`
- **Decision:** Use F13 spec exact response shape with `error` field (not `message`), `retryAfter` field, and `Retry-After` HTTP header
- **Rationale:** Matches the API design document exactly; `Retry-After` header is standard (RFC 6585)
- **Impact:** Code review (Agent 08) caught that the initial implementation had a human-readable error string; fixed to `"rate_limit_exceeded"` per spec.

### LRU eviction at 10,000 entries
- **Decision:** Cap the IP map at 10,000 entries with LRU eviction of stale entries (lastAccess > 2× window)
- **Rationale:** Bounded memory growth; 10,000 IPs is far more than any single-instance deployment will see. Eviction threshold of 2× window (120s) ensures recently-active IPs aren't evicted.
- **Impact:** Memory is bounded regardless of traffic volume; stale IPs are cleaned up automatically.

### Env var configurability
- **Decision:** `RATE_LIMIT_WINDOW_MS` and `RATE_LIMIT_MAX_REQUESTS` env vars override defaults
- **Rationale:** Allows easy tuning for testing and deployment without code changes
- **Impact:** Defaults match F13 spec (60s window, 100/60 max); env vars allow operator override.

## Frontend Decisions (M2-T4)

### Detail View Data Strategy — useAsyncData with Reactive Key
- **Decision:** Use `useAsyncData()` with a key that includes the time window preset (not `Date.now()` values) to make re-fetches reactive
- **Rationale:** `fromMs`/`toMs` are computed from `Date.now()` and would change on every render, invalidating the cache. Using the preset name as the key is stable and only changes when the user selects a different time range.
- **Impact:** Key pattern: `` `monitor-detail-${monitorId}-${timeWindow}` `` — reactive, cacheable, efficient.

### Data Extraction via Computed Properties
- **Decision:** Extract all data fields (targetName, qualityState, summary, etc.) from `historyData.value?.series[0]` via computed properties
- **Rationale:** Keeps the template clean and avoids deep optional chaining. Computed properties are cached and reactive — when `historyData` changes, all derived values update automatically.
- **Impact:** Default fallback values (e.g., `defaultSummary`) prevent null errors in child components.

### 404 Handling via navigateTo() Redirect
- **Decision:** Use `navigateTo("/")` in the script setup block for invalid monitor IDs (≤0)
- **Rationale:** Simple, declarative, and happens before rendering — no need for a separate API call to check existence. The history API already returns 404 for non-existent monitors, but this guards against malformed URLs.
- **Impact:** Users with invalid URLs are redirected to the dashboard home without seeing a broken page.

### Monitor Summary as 9-Card Grid
- **Decision:** Display range summary metrics as a 9-card grid (packet loss, avg latency, min latency, max latency, p95 latency, samples, stable %, unstable %, disconnected %)
- **Rationale:** Matches the desktop app's summary panel layout; provides at-a-glance view of key metrics
- **Impact:** `MonitorSummary.vue` is a self-contained presentational component with color-coded values (accent/warning/danger)

### Threshold from Target Configuration
- **Decision:** Read `thresholdMs` from `series[0].target.thresholds.p95LatencyMs` — uses the monitor's configured threshold
- **Rationale:** Each monitor can have different thresholds (matching the desktop app's per-target configuration)
- **Impact:** Chart threshold line is dynamic per monitor, not hardcoded

## Agent 02 Skip Decision (M2-T4)

### Task Already Complete — No Implementation Needed
- **Decision:** Agent 02 (Implement) was skipped for M2-T4 because the implementation was already fully complete on the `develop` branch
- **Rationale:** All 6 acceptance criteria were met by existing code created during earlier M2 sessions (M2-T3). The detail view page, components, composables, and utilities were all functional.
- **Impact:** Agent 02 verified completeness (typecheck clean, dev server starts, 854 tests pass) rather than implementing. This is a pattern — always check for existing implementation before coding.

## M2-T5 — WebSocket Live Chart Updates

### Centralized useLiveChart Bridge (Not Per-Component)
- **Decision:** Create a single `useLiveChart` composable as the bridge between `useWebSocket` and chart components, rather than wiring WebSocket directly into each chart component
- **Rationale:** DRY — avoids duplicating subscription management, data transforms, and rAF debouncing across components. Single point of failure, single point of test. Follows the existing composable-driven architecture (M2 pattern).
- **Impact:** Chart components consume `liveData` via computed properties — rendering and data flow are cleanly separated

### rAF-Debounced Update Callbacks (Not Reactive Watch)
- **Decision:** Use `onUpdate(callback)` with `requestAnimationFrame` instead of `watch(liveData, ..., { deep: true })` for triggering chart updates
- **Rationale:** rAF batches updates to one per frame — critical when samples arrive at high frequency (e.g., 1-second ping intervals). `deep: true` watch on a Map would trigger Vue's reactivity system for every sample, causing unnecessary re-renders.
- **Impact:** Chart updates are smooth and efficient — no frame drops even with rapid sample arrival

### Bounded Data at 2000 Points
- **Decision:** Cap per-monitor data at 2000 points (`MAX_POINTS_PER_MONITOR`), dropping oldest when exceeded
- **Rationale:** Prevents unbounded memory growth during long sessions. 2000 points = ~33 minutes at 1s intervals, which exceeds any realistic chart view. Matches the `maxPoints: 2000` used in the history API.
- **Impact:** Memory-bounded live data; oldest points are silently dropped when cap is reached

### Live Data Prefers Over HTTP Data in Computed
- **Decision:** Chart data computed properties check `liveData` first, then fall back to HTTP-fetched data
- **Rationale:** WebSocket data is more recent (includes the latest samples); HTTP data provides the initial full history. When live data exists, it's the source of truth.
- **Impact:** Seamless transition from initial load (HTTP) to live updates (WebSocket) — no visual glitch

### Float64Array for Chart Data
- **Decision:** Store chart data as `Float64Array` (typed arrays) rather than plain JavaScript arrays
- **Rationale:** uPlot expects `Float64Array` for `setData()` — using typed arrays avoids conversion overhead. Also more memory efficient.
- **Impact:** Zero-copy data transfer to uPlot; better performance on large datasets

## M2-T6 — Client Settings Page

### GET Settings Endpoint with Computed sync_status
- **Decision:** Create a dedicated GET endpoint (`GET /api/clients/:slug/settings`) that returns the full `ClientSettings` object with a computed `sync_status` field
- **Rationale:** The existing `GET /api/clients/:slug` endpoint returns `ClientResponse` (which excludes internal sync fields). A separate settings endpoint provides the complete configuration needed by the settings page, including `sync_status` derived from `last_synced_at_ms` and `sync_interval_min`. This follows the established pattern of separate API shapes for different consumers.
- **Impact:** Settings page has a single-source-of-truth endpoint; status computation is server-side (consistent across tabs/clients)

### Sync Status as 5-State Enum
- **Decision:** Define `SyncStatus` as a 5-state union type: `"connected" | "disconnected" | "syncing" | "disabled" | "not_configured"`
- **Rationale:** F9 spec requires these 5 states for comprehensive sync state representation. `not_configured` distinguishes "never synced" from "connected but no data"; `syncing` is a transient UI state
- **Impact:** `SyncStatus` type in `shared/types.ts`; `computeSyncStatus()` pure function in the GET endpoint; 5-state component in `SyncStatusIndicator.vue`

### computeSyncStatus as Pure Function
- **Decision:** Extract `computeSyncStatus()` as a standalone pure function — not embedded in the route handler
- **Rationale:** The computation (enabled? → null check? → threshold comparison?) is testable in isolation. The same logic is used by both the GET endpoint and the settings page's computed property. Having it as a pure function enables unit testing and reuse.
- **Impact:** `computeSyncStatus(syncEnabled, lastSyncedAtMs, syncIntervalMin)` returns `SyncStatus` — no side effects, fully testable

### Threshold: 2 × sync_interval_min × 60000 ms
- **Decision:** Use `2 * sync_interval_min * 60000` as the disconnect threshold — client is "disconnected" if no data received within 2× the configured interval
- **Rationale:** 2× interval provides a reasonable grace period — one missed sync cycle before declaring disconnected. This matches the F9 spec and is intuitive for users.
- **Impact:** A client with 5-minute interval is disconnected after 10 minutes of silence; 60-minute interval after 120 minutes

### Settings Broadcast to All WebSocket Peers
- **Decision:** `broadcastSettingsUpdate()` broadcasts to ALL connected WebSocket peers (not just subscribers of a specific monitor)
- **Rationale:** Settings changes are globally relevant — any connected dashboard tab should reflect the updated configuration. Unlike sample broadcasts (which are per-monitor), settings are cross-cutting.
- **Impact:** New WebSocket message type `client_settings_updated` with global broadcast scope; iterates all subscription sets

### Optimistic Update with Rollback in useClientSettings
- **Decision:** `useClientSettings` composable uses optimistic UI updates — apply changes immediately, rollback on error
- **Rationale:** Follows the established pattern (inline name editing, settings form) — improves perceived responsiveness. The rollback ensures data consistency on failure.
- **Impact:** Settings form shows updated values immediately; if PUT fails, UI reverts to previous state with error message

### HTTP Allowed for Localhost URLs
- **Decision:** Backend URL validation allows HTTP for localhost/127.0.0.1/::1 URLs (dev convenience)
- **Rationale:** Local development environments use `http://localhost:3000` — requiring HTTPS would block local testing. This is a pragmatic exception with clear boundaries.
- **Impact:** Both frontend (`SyncSettingsForm.vue`) and backend (`[slug].settings.put.ts`) implement identical localhost exception logic
