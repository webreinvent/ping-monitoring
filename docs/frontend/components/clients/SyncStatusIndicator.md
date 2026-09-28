# Component: SyncStatusIndicator

**File:** `app/components/clients/SyncStatusIndicator.vue`
**Feature:** M2-T6 (Client settings page) / F9

## Purpose

Visual indicator showing the sync status of a client. Displays a colored dot (with optional pulsing animation) and a human-readable status label. Uses the 5-state `SyncStatus` type from `shared/types.ts`.

## Props

| Prop | Type | Required | Description |
|------|------|----------|-------------|
| `status` | `SyncStatus` | Yes | Current sync status |

### SyncStatus Type (F9 Spec)

```typescript
import type { SyncStatus } from "#shared/types";
// SyncStatus = "connected" | "disconnected" | "syncing" | "disabled" | "not_configured"
```

## Events

None.

## Slots

None.

## Usage

```vue
<template>
  <SyncStatusIndicator :status="syncStatus" />
</template>

<script setup lang="ts">
import type { SyncStatus } from "#shared/types";

// Computed from client data (see settings page pattern below)
const syncStatus = computed<SyncStatus>(() => {
  const d = clientData.value;
  if (!d) return "not_configured";
  if (!d.sync_enabled) return "disabled";
  if (d.last_synced_at_ms == null) return "not_configured";
  const now = Date.now();
  const threshold = 2 * d.sync_interval_min * 60000;
  if (now - d.last_synced_at_ms > threshold) return "disconnected";
  return "connected";
});
</script>
```

## Status Mapping

| Status | Display Text | Visual |
|--------|-------------|--------|
| `connected` | "Connected" | Static dot (green) |
| `disconnected` | "Disconnected" | Static dot (red) |
| `syncing` | "Syncing..." | Pulsing dot (yellow) |
| `disabled` | "Disabled" | Static dot (gray) |
| `not_configured` | "Not configured" | Static dot (gray) |

## CSS Classes

- `.sync-status` — Container with status-specific modifier class
- `.sync-status.connected` — Green/teal styling
- `.sync-status.disconnected` — Red styling
- `.sync-status.syncing` — Pulsing animation on the dot (yellow)
- `.sync-status.disabled` — Gray/disabled styling
- `.sync-status.not_configured` — Gray styling
- `.sync-dot.pulsing` — CSS animation for syncing state (only applied when status is `syncing`)

## Data Attributes

| Attribute | Element | Purpose |
|-----------|---------|---------|
| `data-testid="sync-status"` | `.sync-status` | E2E test selector |

## Edge Cases

- **Unknown status value:** If the parent passes a value not matching `SyncStatus`, the `statusText` computed will return `undefined`. The component should only receive valid status values from the shared `SyncStatus` type.

## Related

- [Client Settings Page](../pages/clients-slug-settings.md) — Primary consumer
- [SyncSettingsForm](./SyncSettingsForm.md) — Form that changes sync settings
- [Client Settings API](../../../api/clients-settings.md) — Source of sync status data (GET endpoint)
- [Shared Types](../../../shared/types.md) — `SyncStatus` type definition
