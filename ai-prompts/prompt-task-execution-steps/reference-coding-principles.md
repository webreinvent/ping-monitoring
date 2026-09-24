# LNPM Coding Principles

## General

1. **Follow existing patterns.** Before writing new code, read the file you are extending. Match its naming, comment density, error handling, and import style.
2. **Type safety.** TypeScript `strict: true` with `noUnusedLocals`, `noUnusedParameters`, `noFallthroughCasesInSwitch`. No `any` without a JSDoc justification.
3. **Smallest change that satisfies the task.** Do not refactor unrelated code. Do not add abstractions the task does not require.
4. **Test what you change.** Every new/modified function gets a test. If a test cannot be written, note why.
5. **Document in AGENTS.md, not in code comments.** Code comments explain *why* (non-obvious decisions). AGENTS.md documents *how* (patterns, conventions, ADRs).

## Dashboard (Nuxt 4 / Nitro)

- **API routes:** `defineEventHandler`, return structured JSON, wrap in try/catch. Use h3 `createError({ statusCode, statusMessage, data: { error, code } })` for errors.
- **DB access:** Always `getDb()` from `~/server/utils/db`. Never import the Nitro plugin directly. Use parameterized queries (`?` placeholders) — no SQL string concatenation.
- **Migrations:** Numbered 3-digit prefix, idempotent (`IF NOT EXISTS`), also update `index.sql`.
- **Shared types:** `dashboard/shared/types.ts` is the client-server contract. Import explicitly (`import type { ... } from "#shared/types"`). Nuxt auto-import does NOT work for type-only exports.
- **WebSocket:** Nitro native `defineWebSocketHandler` in `server/routes/ws/`. To call broadcast functions from API routes, use dynamic `import()` to avoid circular deps.
- **Nitro plugins:** Return a cleanup function for shutdown. Register in `nuxt.config.ts` if not auto-discovered.
- **Vue components:** `<script setup lang="ts">`, `useHead()` for titles, `data-testid` for E2E, scoped CSS. No Tailwind, no PrimeVue.
- **Composables:** Encapsulate data-fetching and state. Use `ref`/`computed`, not Pinia. `useAsyncData` for server data; reactive keys for dynamic queries.
- **Charts (uPlot):** Qual plugin for quality bands, Point plugin for thresholds. `useLiveChart` bridges WS → bounded `Float64Array` (cap 2000) → rAF-debounced updates. NaN for gaps.
- **CSS:** Plain scoped CSS with design tokens from `dashboard/app/assets/css/dashboard.css`. No CSS-in-JS, no utility framework.

## Tauri Frontend (TypeScript)

- **No framework.** Plain TypeScript, imperative DOM via `innerHTML` templates in `src/main.ts`.
- **IPC:** All backend calls go through `src/api.ts` (`invoke<ReturnType>("command_name", { args })`). Never call Rust directly.
- **Events:** Rust pushes state via Tauri events (`listen("dashboard-updated")`, `"quality-transition"`, `"sync-status-changed"`, etc.). Re-render on event, not on timer.
- **State:** Module-level `let` variables in `src/main.ts`. No state library.
- **CSS:** `src/styles.css` — plain CSS.

## Rust (src-tauri)

- **Ping:** System shell-out (`SystemPingProbe` in `probe.rs`). Unix: `ping -c 1 -W <sec> <ip>`. Windows: `ping -n 1 -w <ms> <ip>`. Wall-clock cap = `timeout_ms + 500`.
- **DB:** `rusqlite` (sync API), wrapped in `spawn_blocking`. Schema versioning via `schema_info` table + `ALTER TABLE` migrations.
- **Async:** `tokio` runtime. One task per target in `monitor.rs` (`run_target_loop` + `tokio::time::interval`).
- **Errors:** `thiserror` enums (`MonitorError`, `StorageError`, `CommandError`). `From` impls between layers. Commands return `Result<T, CommandError>`.
- **Serde:** `rename_all = "camelCase"` for all structs. Exception: `mac_address` in `sync.rs` IngestPayload (snake_case, matches dashboard contract).
- **Commands:** `#[tauri::command]` in `commands.rs`. Register in `generate_handler!` in `lib.rs`. State = `AppState { monitor, database, sync_service }`.
- **Events (Rust→FE):** `MonitorEventSink` trait; `TauriEventSink` in `tray.rs` emits Tauri events + batches native notifications (2.5s window).
- **Sync:** `sync.rs` — background tokio loop. Batches unsynced samples every `batch_timeout_ms` (5s) or `periodic_interval_min` (5min). Exponential backoff (3 retries). `targetHost` is the host string (not UUID).

## Testing

- **Vitest (root):** `pnpm test` — colocated `*.test.ts` in `src/`. Mock `@tauri-apps/api`.
- **Vitest (dashboard):** `cd dashboard && pnpm test` — colocated `*.test.ts`. Mock better-sqlite3 (native module crashes forked workers). `pool: 'forks'`, `setupFiles: './test/setup.ts'`.
- **Rust:** `cargo test --locked` — `#[cfg(test)]` modules in same file. Use `tempfile` for DB tests.
- **Playwright E2E:** `cd dashboard && pnpm test:e2e` — `dashboard/tests/e2e/*.spec.ts`. Use `data-testid` selectors. `workers: 1` (serial, for WS state isolation).
- **Naming:** Unit `*.test.ts`, integration `*.integration.test.ts`, edge cases `*.edge-cases.test.ts`.

## Git & Commits

- **Branch:** `feature/M{N}-T{M}-{slug}` from `develop`.
- **Commit:** `type(scope): [TASK_ID] short description`
  - Body: 1–5 bullets describing what was done.
  - Footer: `Refs: ai-milestones-and-tasks/milestone-{NN}-{name}/task-{ID}-*.md` (exact filename, no wildcard).
- **Do NOT push** without explicit user confirmation.

## Security

- **SQL:** Parameterized queries only. No string concatenation.
- **Env vars:** Read from `process.env` with validation. Never hardcode.
- **Rate limiting:** Per-IP sliding window (ingest 100/min, others 60/min) via `server/middleware/rate-limit.ts`.
- **CSP (Tauri):** `tauri.conf.json` — `default-src 'self'; connect-src 'self' ipc: http://ipc.localhost`. No external HTTP from webview.
- **Input validation:** Dashboard ingest validates shape, caps at `INGEST_MAX_SAMPLES` (1000), deduplicates via `UNIQUE(monitor_id, timestamp_ms, resolved_address)`.
