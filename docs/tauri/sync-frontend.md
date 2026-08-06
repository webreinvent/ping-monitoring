# Sync Status Icon & Cloud Sync Settings (M2-T9 / F4)

## Purpose

Frontend UI components for the cloud sync feature: a sync status icon in the main toolbar and a Cloud Sync settings section with URL input, pause toggle, and manual sync button.

## Files

- `src/main.ts` — Sync icon element (toolbar), Cloud Sync settings section (settings dialog)
- `src/styles.css` — Sync status icon states, animations, settings section styles
- `src/api.ts` — `getSyncStatus()`, `triggerSyncNow()` API methods
- `src/types.ts` — `SyncStatus`, `SyncEvent`, `SyncResult` types
- `src/validation.test.ts` — URL validation tests
- `src/sync-icon.test.ts` — Icon state mapping tests

## Sync Status Icon

### Location

Main toolbar, between `pause-monitoring` and `open-settings` buttons.

### States

| State | Icon | CSS Class | Behavior |
|-------|------|-----------|----------|
| `off` | `⊘` | `.sync-status-icon[data-sync-state="off"]` | Opacity 0.4 (dimmed) |
| `paused` | `⏸` | `.sync-status-icon[data-sync-state="paused"]` | Normal |
| `idle` | `☁` | `.sync-status-icon[data-sync-state="idle"]` | Normal |
| `syncing` | `↻` | `.sync-status-icon[data-sync-state="syncing"]` | Spin animation (`@keyframes spin`, 1s linear infinite) |
| `success` | `✓` | `.sync-status-icon[data-sync-state="success"]` | Auto-reverts to `idle` after 3s (setTimeout) |
| `error` | `✗` | `.sync-status-icon[data-sync-state="error"]` | Normal |

### Implementation

```typescript
// Icon mapping (tested in sync-icon.test.ts)
const SYNC_STATE_ICONS: Record<string, string> = {
  off: "⊘", paused: "⏸", idle: "☁",
  syncing: "↻", success: "✓", error: "✗",
};

function syncStateIcon(status: string): string {
  return SYNC_STATE_ICONS[status] ?? "⊘";
}
```

### Event Handling

1. **On boot**: `await api.getSyncStatus()` → seed initial state
2. **On `sync-status-changed` event**: Update `data-sync-state` attribute, update `title` (tooltip), update icon character
3. **On click**: Open settings dialog and scroll to Cloud Sync section
4. **Success auto-revert**: `setTimeout(() => setState("idle"), 3000)`

## Cloud Sync Settings Section

### Location

New section in the existing settings dialog (after the existing settings sections).

### UI Components

```html
<section class="settings-section cloud-sync-section">
  <h4>${t("section.cloudSync")}</h4>

  <!-- URL Input -->
  <label>
    <span>${t("cloudSync.endpoint")}</span>
    <input type="url" name="dashboardIngestUrl" placeholder="http://localhost:3000/api/ping/ingest">
    <small>${t("cloudSync.endpointHint")}</small>
  </label>

  <!-- Pause Toggle -->
  <label class="inline-toggle">
    <input type="checkbox" name="cloudSyncPaused">
    <span>${t("cloudSync.pause")}</span>
  </label>

  <!-- Actions -->
  <div class="inline-actions">
    <button id="sync-now" type="button" class="button ghost">${t("cloudSync.syncNow")}</button>
    <span id="sync-status-text" class="sync-status-text">${formatSyncStatus(status)}</span>
  </div>
</section>
```

### URL Validation

Uses `validateIngestUrl(raw: string)` — tested in `validation.test.ts`:

| Input | Result |
|-------|--------|
| Empty string | `{ ok: true, url: "" }` (disabled) |
| `http://localhost:3000/api/ping/ingest` | `{ ok: true, url: "..." }` |
| `https://dashboard.example.com/...` | `{ ok: true, url: "..." }` |
| `ftp://example.com` | `{ ok: false, reason: "URL must use http:// or https://" }` |
| `not-a-url` | `{ ok: false, reason: "Enter a valid URL" }` |
| 2049+ character URL | `{ ok: false, reason: "URL is too long" }` |

### "Sync Now" Button

- **Disabled when**: No URL configured OR sync is paused
- **Behavior**: Calls `api.triggerSyncNow()`, shows toast with `{ accepted, duplicate, rejected }` counts
- **Error handling**: Shows error toast on failure (network error, HTTP error, etc.)

### Pause Toggle

- Binds to `cloudSyncPaused` boolean in `AppSettings`
- When checked: Cancels background sync task, emits `SyncStatus::Paused`
- When unchecked (and URL set): Restarts background sync task
- Does NOT clear the endpoint URL — un-pausing resumes sync immediately

## Status Text Display

The `#sync-status-text` element shows a human-readable status using locale keys:

| Status | Key | en |
|--------|-----|-----|
| off | `cloudSync.status.off` | "Sync off" |
| paused | `cloudSync.status.paused` | "Sync paused" |
| idle | `cloudSync.status.idle` | "Sync idle" |
| syncing | `cloudSync.syncing` | "Syncing…" |
| success | `cloudSync.status.success` | "Synced" |
| error | `cloudSync.status.error` | "Sync error" |

## CSS Patterns

### Sync Status Icon Animations

```css
@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

.sync-status-icon[data-sync-state="syncing"]::before {
  animation: spin 1s linear infinite;
}

.sync-status-icon[data-sync-state="off"] {
  opacity: 0.4;
}
```

### Color States

Each sync state has a specific color:
- **off**: Inherit (dimmed via opacity)
- **paused**: `--warning` (yellow)
- **idle**: `--accent` (teal)
- **syncing**: `--primary` (blue)
- **success**: `--success` (green)
- **error**: `--danger` (red)

## TypeScript Types

```typescript
export type SyncStatus = "off" | "paused" | "idle" | "syncing" | "success" | "error";

export interface SyncEvent {
  status: SyncStatus;
  message: string | null;
  lastSyncedAtMs: number | null;
  pendingCount: number;
}

export interface SyncResult {
  accepted: number;
  duplicate: number;
  rejected: number;
}
```

## API Methods

```typescript
// src/api.ts
export const api = {
  // ... existing methods ...
  getSyncStatus: () => invoke<SyncEvent>("get_sync_status"),
  triggerSyncNow: () => invoke<SyncResult>("trigger_sync_now"),
};
```

## Locale Keys

All 5 locale files (en, ko, ja, zh-CN, zh-TW) include:

```json
{
  "section.cloudSync": "Cloud Sync",
  "cloudSync.endpoint": "Dashboard endpoint URL",
  "cloudSync.endpointHint": "URL of the LNPM Cloud Dashboard ingest endpoint",
  "cloudSync.pause": "Pause sync",
  "cloudSync.pauseHint": "Stop syncing without clearing the endpoint URL",
  "cloudSync.syncNow": "Sync now",
  "cloudSync.syncing": "Syncing…",
  "cloudSync.status.off": "Sync off",
  "cloudSync.status.paused": "Sync paused",
  "cloudSync.status.idle": "Sync idle",
  "cloudSync.status.syncing": "Syncing…",
  "cloudSync.status.success": "Synced",
  "cloudSync.status.error": "Sync error",
  "action.syncStatus": "Sync status",
  "toast.syncSuccess": "Synced {accepted} samples ({duplicate} duplicates)",
  "toast.syncError": "Sync failed: {message}"
}
```
