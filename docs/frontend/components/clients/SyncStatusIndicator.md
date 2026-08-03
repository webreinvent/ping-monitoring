# Component: SyncStatusIndicator

**File:** `app/components/clients/SyncStatusIndicator.vue`
**Feature:** M2-T6 (Client settings page)

## Purpose

Visual indicator showing the sync status of a client. Displays a colored dot (with optional pulsing animation) and a human-readable status label.

## Props

| Prop | Type | Required | Description |
|------|------|----------|-------------|
| `status` | `SyncStatus` | Yes | Current sync status |

### SyncStatus Type

```typescript
type SyncStatus = "connected" | "syncing" | "error" | "disabled";
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
const syncStatus = computed<"connected" | "syncing" | "error" | "disabled">(
  () => clientData.value?.sync_enabled ? "connected" : "disabled"
);
</script>
```

## Status Mapping

| Status | Display Text | Visual |
|--------|-------------|--------|
| `connected` | "Synced" | Static dot |
| `syncing` | "Syncing..." | Pulsing dot |
| `error` | "Sync Error" | Static dot (error color) |
| `disabled` | "Sync Disabled" | Static dot (gray) |

## CSS Classes

- `.sync-status` — Container with status-specific modifier class
- `.sync-status.connected` — Green/teal styling
- `.sync-status.syncing` — Pulsing animation on the dot
- `.sync-status.error` — Red/error styling
- `.sync-status.disabled` — Gray/disabled styling
- `.sync-dot.pulsing` — CSS animation for syncing state (only applied when status is `syncing`)

## Data Attributes

| Attribute | Element | Purpose |
|-----------|---------|---------|
| `data-testid="sync-status"` | `.sync-status` | E2E test selector |

## Edge Cases

- **Unknown status value:** If the parent passes a value not matching `SyncStatus`, the `statusText` computed will return `undefined`. The component should only receive valid status values.

## Related

- [Client Settings Page](../pages/clients-slug-settings.md) — Primary consumer
- [SyncSettingsForm](./SyncSettingsForm.md) — Form that changes sync settings
- [Client Identity API](../../../api/clients.md) — Source of sync status data
