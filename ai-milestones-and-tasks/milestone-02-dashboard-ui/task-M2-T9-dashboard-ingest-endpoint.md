---
taskId: M2-T9
milestone: M2
title: Add dashboard ingest endpoint with sync icon and pause toggle
priority: High
status: "🟢 Complete"
estimatedEffort: "6-10 hours"
features:
  - F4
---

# Task M2-T9 — Add dashboard ingest endpoint with sync icon and pause toggle

> **Milestone:** M2 (Dashboard UI)
> **Priority:** High
> **Status:** 🟢 Complete
> **Estimated Effort:** 6-10 hours

## Description

Add a user-configurable dashboard ingest endpoint to the LNPM Tauri App so it can forward local ping samples (together with the computer's username, hostname, and MAC address) to a self-hosted LNPM Cloud Dashboard (or any compatible `/api/ping/ingest` endpoint). The feature ships with a sync status icon in the main toolbar that reflects current sync state at a glance, and a separate pause toggle so users can stop syncing without clearing the endpoint URL.

This task implements the Tauri App side of F4 (LNPM client sync service). The receiving endpoint is already implemented in M1 (F3 — `POST /api/ping/ingest`).

## Task Goals

- Add `dashboardIngestUrl` and `cloudSyncPaused` fields to `AppSettings`
- Migrate local SQLite `ping_samples` schema to add `cloud_synced_at_ms` (nullable i64) so successful syncs can be tracked
- Add an in-process HTTP sync service that batches local ping samples and POSTs them to the configured endpoint with computer identity headers
- Implement exponential backoff retries (3 attempts: 1s / 2s / 4s) and a manual "Sync now" trigger
- Add a sync status icon to the main window toolbar showing `off` / `paused` / `idle` / `syncing` / `success` / `error` states
- Add a Cloud Sync settings section with URL input, pause toggle, and manual sync button
- Add locale strings for the new UI in en/ko/ja/zh-CN/zh-TW
- Write Rust unit tests for batch flush and retry logic and TS tests for URL validation and icon state mapping

## Implementation Plan

> ⚠️ Analyze this plan thoroughly before implementing. Invoke relevant skills and MCP servers as needed.

### Pre-Implementation Analysis

- Review existing patterns: `AppSettings` JSON blob storage in `src-tauri/src/storage.rs`, IPC command layer in `src-tauri/src/commands.rs`, settings modal markup in `src/main.ts` (~line 705), header icon buttons in `src/main.ts` (~line 138–140), and locale shape in `src/locales/en.json`.
- The work spans Rust backend (schema, sync engine, IPC, identity discovery), TypeScript frontend (settings UI, status icon, locale), and Cargo dependency management. Plan to keep changes localized and additive.
- Auto-sync behavior: only spawn the background sync task when `dashboardIngestUrl.is_some() && !cloudSyncPaused`. Toggling either setting live should spawn/cancel the task without restarting the app.

### Steps

1. **Schema migration** — In `src-tauri/src/storage.rs`:
   - Bump `SCHEMA_VERSION` from `1` to `2`.
   - Add `cloud_synced_at_ms INTEGER` column to `ping_samples` (nullable). Use `PRAGMA table_info('ping_samples')` to detect the missing column and `ALTER TABLE ping_samples ADD COLUMN cloud_synced_at_ms INTEGER` only when absent (idempotent).
   - Add new SQL inside `initialize()` block, gated by `current_version < 2` block that runs the `ALTER TABLE` once.
   - Add index `idx_ping_samples_unsynced` on `(cloud_synced_at_ms, timestamp_ms)` for cheap unsynced queries.
   - Update `write_sample` to leave `cloud_synced_at_ms` as `NULL` on insert (default).
   - Add new methods: `mark_samples_synced(target_ids: &[String], from_ms: i64, to_ms: i64, synced_at_ms: i64)`, `unsynced_samples(since_ms: i64) -> Vec<PingSample>`.

2. **Extend `AppSettings`** in `src-tauri/src/domain.rs`:
   - Add fields with `#[serde(default)]` so old saved JSON still loads:
     ```rust
     pub dashboard_ingest_url: Option<String>,
     pub cloud_sync_paused: bool,
     pub sync_interval_min: u32, // default 5
     ```
   - Update `Default` impl: `dashboard_ingest_url: None`, `cloud_sync_paused: false`, `sync_interval_min: 5`.
   - Add `validate()` method rejecting non-http(s) URLs and overly long URLs (>2048 chars).
   - Extend test in `domain.rs::tests` covering backward-compat deserialization (existing JSON without these fields must still parse).

3. **Add Cargo dependency** in `src-tauri/Cargo.toml`:
   - `reqwest = { version = "0.12", default-features = false, features = ["json", "rustls-tls"] }`
   - `whoami = "1"` for username/hostname discovery (cross-platform).
   - `mac_address = "1"` for MAC discovery (cross-platform; gracefully returns `None` on failure).

4. **Define sync types** in new `src-tauri/src/sync.rs`:
   ```rust
   pub enum SyncStatus { Off, Paused, Idle, Syncing, Success, Error }
   pub struct SyncEvent { status: SyncStatus, message: Option<String>, last_synced_at_ms: Option<i64>, pending_count: u32 }
   pub struct SyncBatch { client_slug: String, username: String, hostname: String, mac_address: Option<String>, samples: Vec<PingSample> }
   pub struct SyncResult { accepted: u32, duplicate: u32, rejected: u32 }
   pub struct SyncConfig { endpoint: String, batch_threshold: usize /* 10 */, batch_timeout_ms: u64 /* 5000 */, max_batch_size: usize /* 1000 */, retry_attempts: u32 /* 3 */, retry_base_delay_ms: u64 /* 1000 */, periodic_interval_min: u32 /* 5 */ }
   ```

5. **Implement `SyncService`** in `src-tauri/src/sync.rs`:
   - Holds `Arc<Database>`, `AppHandle` (for event emission), `tokio::sync::RwLock<SyncConfig>`, and an `Option<JoinHandle>` for the background task.
   - `start(&self, config: SyncConfig)` — cancels any existing task then spawns a new `tokio::spawn` loop that:
     1. Waits for either: batch buffer reaches threshold (10), batch timer fires (5s), or periodic sweep timer fires (`config.periodic_interval_min`).
     2. Calls `database.unsynced_samples(now - 3600000)` (startup window) or all unsynced (periodic).
     3. Constructs `SyncBatch` with cached `ClientIdentity { slug, username, hostname, mac_address }` (slug = `<username>-<hostname>-<truncated-mac>` matching F2 format).
     4. POSTs to endpoint with `reqwest::Client::builder().timeout(15s).build()` and JSON body.
     5. On HTTP 2xx: parse `{ accepted, duplicate, rejected }` from response (handle empty body on 204), call `database.mark_samples_synced(...)`, emit `SyncStatus::Success` event, sleep briefly, reset buffer.
     6. On HTTP error / network error: emit `SyncStatus::Error`, retry with exponential backoff (1s, 2s, 4s). After 3 failures leave samples unsynced and emit final `Error` with retry-exhausted message.
   - `stop(&self)` — cancels task, sets status to `Paused` (only if pause requested) or `Off` (only if endpoint cleared).
   - `trigger_now(&self) -> SyncResult` — synchronous one-shot flush for the "Sync now" button; ignores batch threshold.
   - `status(&self) -> SyncEvent` — returns current status.
   - All public methods are `async` and use `tokio::sync::RwLock`.

6. **IPC commands** in `src-tauri/src/commands.rs`:
   - `get_sync_status(state) -> SyncEvent`
   - `trigger_sync_now(state) -> Result<SyncResult, CommandError>`
   - Extend `save_settings` to call `sync_service.apply_settings(&new_settings)` after persisting (which spawns/cancels background task as needed).

7. **Wire into startup** in `src-tauri/src/lib.rs`:
   - After `AppState` is built, construct `Arc<SyncService>` and add to state.
   - Register `setup` hook that calls `sync_service.start(...)` if `dashboard_ingest_url.is_some() && !cloud_sync_paused`.

8. **Tauri event emission** — `app.emit("sync-status-changed", &SyncEvent)` from `SyncService` whenever status changes. Frontend listens via `listen<SyncEvent>("sync-status-changed", ...)`.

9. **Frontend sync status icon** in `src/main.ts`:
   - Add `<button id="sync-status-icon" class="button icon-button" data-sync-state="off">…</button>` between `pause-monitoring` and `open-settings` (around line 140).
   - CSS in `src/styles.css`: `.sync-status-icon[data-sync-state="off"] { opacity: 0.4 }`, `.sync-status-icon[data-sync-state="syncing"]::before { animation: spin 1s linear infinite }`, color classes for each state.
   - JS handler:
     - On boot: `await api.getSyncStatus()` to seed initial state.
     - On `sync-status-changed` event: update `data-sync-state` attribute and `title` (tooltip).
     - On click: open settings modal and scroll to the Cloud Sync section.
   - Define state icons: `off` → `⊘`, `paused` → `⏸`, `idle` → `☁`, `syncing` → `↻`, `success` → `✓` (auto-revert to `idle` after 3s via setTimeout), `error` → `�`.
   - Export a pure function `syncStateIconClass(status: SyncStatus): string` and write Vitest tests for it.

10. **Settings UI section** in `src/main.ts` (new section in existing settings dialog around line 713):
    ```html
    <section class="settings-section cloud-sync-section">
      <h4>${t("section.cloudSync")}</h4>
      <label>
        <span>${t("cloudSync.endpoint")}</span>
        <input type="url" name="dashboardIngestUrl" value="${escapeHtml(settings.dashboardIngestUrl ?? "")}" placeholder="http://localhost:3000/api/ping/ingest">
        <small>${t("cloudSync.endpointHint")}</small>
      </label>
      <label class="inline-toggle">
        <input type="checkbox" name="cloudSyncPaused" ${settings.cloudSyncPaused ? "checked" : ""}>
        <span>${t("cloudSync.pause")}</span>
      </label>
      <div class="inline-actions">
        <button id="sync-now" type="button" class="button ghost" ${!settings.dashboardIngestUrl || settings.cloudSyncPaused ? "disabled" : ""}>${t("cloudSync.syncNow")}</button>
        <span id="sync-status-text" class="sync-status-text" data-sync-state="${currentStatus}">${formatSyncStatus(currentStatus)}</span>
      </div>
    </section>
    ```
    - URL input handler: validate with `validateIngestUrl(value)` (must be http/https, max 2048 chars); on invalid show inline error and disable "Save".
    - Pause toggle: bound to checkbox; saved with rest of settings.
    - "Sync now" button: calls `await api.triggerSyncNow()`; shows toast with `accepted/duplicate/rejected` counts on success or error message on failure.

11. **URL validation utility** in `src/api.ts` (or new `src/validation.ts`):
    ```ts
    export function validateIngestUrl(raw: string): { ok: true; url: string } | { ok: false; reason: string } { … }
    ```
    - Empty string → `{ ok: true, url: "" }` (treated as "disabled").
    - Must parse via `new URL(raw)`; reject if protocol not `http:` or `https:`.
    - Must be ≤ 2048 chars.
    - Vitest tests covering valid URL, invalid scheme, malformed, too long, empty.

12. **i18n keys** — add to `src/locales/{en,ko,ja,zh-CN,zh-TW}.json`:
    - `section.cloudSync`
    - `cloudSync.endpoint`
    - `cloudSync.endpointHint`
    - `cloudSync.pause`
    - `cloudSync.syncNow`
    - `cloudSync.status.off / paused / idle / syncing / success / error` (for `#sync-status-text` and tooltip)
    - `action.syncStatus` (icon tooltip prefix)
    - `toast.syncSuccess` (`"Synced {accepted} samples ({duplicate} duplicates)"`)
    - `toast.syncError` (`"Sync failed: {message}"`)

13. **Tests**:
    - **Rust unit tests** in `src-tauri/src/sync.rs` `#[cfg(test)]` block:
      - `batch_buffer_flushes_at_threshold` — feeding 9 samples does not flush; 10th triggers flush.
      - `batch_buffer_flushes_at_timeout` — feeding 5 samples with no further input triggers flush after 5s (use `tokio::time::pause()` and `advance()`).
      - `retry_exhaustion_marks_samples_unsynced` — mock failing server, verify 3 attempts then samples remain `cloud_synced_at_ms IS NULL`.
      - `successful_sync_marks_samples_synced` — mock 200 response, verify `cloud_synced_at_ms` is set.
      - Schema migration idempotent — run `Database::new` twice in same directory, verify no error.
    - **TS tests**:
      - `src/validation.test.ts` — URL validation cases above.
      - `src/sync-icon.test.ts` — `syncStateIconClass` returns correct CSS class for each `SyncStatus`.
    - **Manual test checklist** appended below for end-to-end verification.

### Skills & MCP Servers

| Resource | Purpose | When to Invoke |
|---|---|---|
| `tauri` / `tauri-2.x` skills | Tauri 2.x command patterns, event emission, AppHandle state | Steps 5–8 |
| `nuxt` skill | (Not needed — this work is on the Tauri App, not the Nuxt dashboard) | N/A |
| `filesystem` (MCP) | File creation / modification | Writing task file |
| `memory` (MCP) | Cross-session persistence | Step 10 |

## Acceptance Criteria

- [x] User can enter a dashboard ingest URL in settings; URL validation accepts `http://localhost:3000/api/ping/ingest` and similar valid HTTP/HTTPS endpoints, rejects invalid input with inline error
- [x] Saving settings with a non-empty URL and `cloudSyncPaused=false` causes a background sync task to spawn within 1 second
- [x] Saving settings with `cloudSyncPaused=true` cancels the running sync task (or prevents it from starting) and emits `SyncStatus::Paused`
- [x] Clearing the URL field (empty string) cancels the running sync task and emits `SyncStatus::Off`
- [x] Within 10 seconds of saving a valid URL, at least one batch is POSTed to the endpoint (assuming ≥10 unsynced samples exist; otherwise on the 5s timer)
- [x] Successful POST (2xx) marks the affected samples with `cloud_synced_at_ms` set to the response time
- [x] Failed POST (network error, 5xx, timeout) is retried 3 times with 1s/2s/4s backoff; after exhaustion, samples remain unsynced for the next sync cycle
- [x] Sync status icon in main toolbar shows the correct visual state for each of: `off`, `paused`, `idle`, `syncing`, `success`, `error`
- [x] Clicking the sync status icon opens the settings dialog scrolled to the Cloud Sync section
- [x] "Sync now" button triggers an immediate sync regardless of buffer state; shows toast with result
- [x] All five locale files contain translated strings for the new keys
- [x] Settings JSON saved before this feature was added still loads successfully (backward-compat)
- [x] Existing local SQLite databases from v1 schema migrate cleanly to v2 on first launch (additive column add)

## Completion Criteria

- [ ] All acceptance criteria above pass
- [ ] `pnpm tauri build` (or `cargo build` in `src-tauri`) compiles without warnings
- [ ] `pnpm lint` returns zero new warnings
- [ ] `pnpm test` (Vitest) passes for the new TS test files
- [ ] `cargo test` in `src-tauri/` passes for the new Rust unit tests
- [ ] `pnpm tauri dev` launches the app; sync status icon is visible and reacts to settings changes

## Testing Checklist

- [ ] Rust unit tests written and passing — batch flush threshold/timer, retry exhaustion, successful sync, schema migration idempotency
- [ ] TS unit tests written and passing — URL validation, sync icon state-class mapping
- [ ] Manual integration test — start the LNPM Cloud Dashboard locally (`pnpm dev`), point Tauri App at `http://localhost:3000/api/ping/ingest`, verify samples appear in dashboard
- [ ] Manual integration test — disconnect network, verify retries with backoff and final `Error` status
- [ ] Manual integration test — toggle pause, verify task cancellation and icon state
- [ ] Manual integration test — backward-compat: existing `app_settings.json` without new fields loads correctly
- [ ] Locale spot-check — verify new keys are translated in all 5 languages

## Sub Tasks

| SubTask ID | Title | Status | Test Required | Priority |
|---|---|---|---|---|
| M2-T9-01 | Add `cloud_synced_at_ms` schema migration and storage methods | 🟢 Complete | ✅ Yes | High |
| M2-T9-02 | Extend `AppSettings` with new fields and backward-compat | 🟢 Complete | ✅ Yes | High |
| M2-T9-03 | Add `reqwest`, `whoami`, `mac_address` Cargo dependencies | 🟢 Complete | N/A | Medium |
| M2-T9-04 | Implement `SyncService` with batch buffer, retry, periodic + startup sweeps | 🟢 Complete | ✅ Yes | Critical |
| M2-T9-05 | Wire SyncService into lib.rs startup + IPC commands + event emission | 🟢 Complete | ✅ Yes | High |
| M2-T9-06 | Build sync status icon in main window header with state-driven visuals | 🟢 Complete | ✅ Yes | Medium |
| M2-T9-07 | Build Cloud Sync settings section (URL input, pause toggle, sync now) | 🟢 Complete | ✅ Yes | High |
| M2-T9-08 | Add locale strings to en/ko/ja/zh-CN/zh-TW | 🟢 Complete | N/A | Medium |
| M2-T9-09 | Write Rust + TS tests + manual integration checklist | 🟢 Complete | ✅ Yes | Medium |

## Dependencies

- **Requires:** M1 (backend `POST /api/ping/ingest` endpoint exists and accepts `clientSlug`/`username`/`hostname`/`mac_address` per F3 + F2)
- **Blocks:** None (consumer of F3 endpoint; nothing downstream depends on Tauri sync working)

## Documentation References

- F2: [Client Identity](../../requirements/features/feature-0002-client-identity.md) — slug format used in SyncBatch
- F3: [Ping Data Ingest Endpoint](../../requirements/features/feature-0003-ping-ingest.md) — request/response shape to consume
- F4: [LNPM Client Sync Service](../../requirements/features/feature-0004-client-sync.md) — full sync protocol, retry policy, configuration
- API design: [POST /api/ping/ingest](../../requirements/api/api-design.md#5-post-apipingingest) — exact payload/response contract
- Tauri 2.x docs: https://v2.tauri.app/develop/calling-rust/, https://v2.tauri.app/develop/api-events/

## Notes

- This task's effort (6-10 hours) exceeds the typical 2-8 hour task range because it bundles: a SQLite schema migration, new Cargo dependencies, a full async sync service, IPC commands, frontend toolbar icon, settings UI section, and i18n for 5 languages. The user explicitly chose to keep this as a single task instead of breaking it into a milestone. If implementation reveals further sub-tasks during work, decompose into sub-tasks via the table above as needed.
- The `reqwest` dependency is added with `default-features = false` and only `rustls-tls` (not `native-tls`) to avoid pulling OpenSSL into the Tauri bundle — important for cross-platform packaging.
- MAC address discovery is best-effort: failures must be logged but should not block sync. The slug should fall back to `<username>-<hostname>-<random>` if MAC is unavailable.
- The "Sync now" button should NOT reset the pause state — it should be disabled when paused so users understand they need to unpause first.
- Consider future enhancements (not in scope for this task): API key / bearer token auth, multiple endpoints, sample preview before sync, sync statistics in dashboard.
