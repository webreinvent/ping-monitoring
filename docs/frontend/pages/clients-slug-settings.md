# Page: Client Settings

**File:** `app/pages/clients/[slug]/settings.vue`
**Route:** `/clients/:slug/settings`
**Feature:** M2-T6 (Client settings page) / F9

## Purpose

Settings page for a specific client showing:
1. Current sync status (5-state indicator: connected/disconnected/syncing/disabled/not_configured)
2. Client identity information (read-only: slug, name, username, hostname, MAC)
3. Sync configuration form (toggle, interval, backend URL)

## Usage

This page is rendered by Nuxt's file-based routing at `/clients/:slug/settings`. It renders inside the `default` layout.

### Navigation

```vue
<!-- From client overview or sidebar -->
<NuxtLink :to="`/clients/${clientSlug}/settings`">Settings</NuxtLink>
```

## Structure

```
clients/[slug]/settings.vue (.client-settings-page)
├── NavigationBreadcrumb (label=client name, to="/clients/:slug")
├── [loading state]
│   └── "Loading settings..."
├── [data state]
│   ├── .page-heading
│   │   └── h2: "Settings"
│   ├── SyncStatusIndicator (status=syncStatus)
│   ├── .page-heading
│   │   └── h3: "Client Identity"
│   ├── ClientIdentity (identityData)
│   ├── .page-heading
│   │   └── h3: "Sync Configuration"
│   └── SyncSettingsForm (clientSlug, initialSettings, @saved)
└── [no data state]
    └── EmptyState: "Client not found"
```

## Components Used

| Component | Purpose |
|-----------|---------|
| [NavigationBreadcrumb](../components/shared/NavigationBreadcrumb.md) | Back navigation to client overview |
| [SyncStatusIndicator](../components/clients/SyncStatusIndicator.md) | Current sync status display (5 states) |
| [ClientIdentity](../components/clients/ClientIdentity.md) | Read-only client identity information |
| [SyncSettingsForm](../components/clients/SyncSettingsForm.md) | Settings form with validation |
| [EmptyState](../components/shared/EmptyState.md) | Client not found fallback |

## Data Flow

1. `useAsyncData` fetches client data from `GET /api/clients/:slug`
2. `syncStatus` computed derives the 5-state status from `sync_enabled`, `last_synced_at_ms`, and `sync_interval_min`
3. `identityData` computed extracts read-only identity fields (slug, name, username, hostname, mac_address)
4. `initialSettings` computed transforms the API response into form-friendly values
5. `SyncSettingsForm` handles the form submission via `PUT /api/clients/:slug/settings`
6. On `@saved` event, `refreshNuxtData()` re-fetches the client data to update the page

### Sync Status Computation

```typescript
const syncStatus = computed(() => {
  const d = clientData.value;
  if (!d) return "not_configured";
  if (!d.sync_enabled) return "disabled";
  if (d.last_synced_at_ms == null) return "not_configured";
  const now = Date.now();
  const threshold = 2 * d.sync_interval_min * 60000;
  if (now - d.last_synced_at_ms > threshold) return "disconnected";
  return "connected";
});
```

**States:**
- `"disabled"` — sync is explicitly turned off
- `"not_configured"` — no sync has ever occurred (null `last_synced_at_ms`)
- `"disconnected"` — no data received within 2× the configured interval
- `"connected"` — data received within the threshold

### Settings Derivation

```typescript
const initialSettings = computed(() => {
  const d = clientData.value;
  return {
    sync_enabled: d ? !!d.sync_enabled : false,
    sync_interval_min: d ? d.sync_interval_min : 5,
    backend_url: d ? d.backend_url : "",
  };
});
```

### Refresh on Save

```typescript
async function handleSettingsSaved(): Promise<void> {
  await refreshNuxtData(`client-settings-${slug.value}`);
}
```

When the form emits `saved`, the page re-fetches data via Nuxt's `refreshNuxtData()` using the same key as the initial `useAsyncData` call. This updates `clientData`, which cascades to all computed properties (`syncStatus`, `identityData`, `initialSettings`).

## Head

Dynamic page title based on the client name:

```typescript
useHead({
  title: computed(() => `Settings — ${clientData.value?.name ?? slug.value}`),
});
```

## Data Attributes

| Attribute | Element | Purpose |
|-----------|---------|---------|
| `data-testid="client-settings-page"` | Page container | E2E test selector |

## Edge Cases

- **Client not found:** The API returns 404 — `EmptyState` is shown.
- **Sync disabled:** `SyncStatusIndicator` shows "Disabled" — the form reflects the disabled state.
- **Never synced:** `SyncStatusIndicator` shows "Not configured" — sync is enabled but no data has been received.
- **Disconnected:** `SyncStatusIndicator` shows "Disconnected" — no data within 2× the configured interval.
- **Form submission error:** The form displays the error message inline — the page does not navigate away.

## Related

- [Client Overview Page](./clients-slug.md) — Parent page
- [Client Settings API](../../api/clients-settings.md) — `GET` and `PUT` endpoints
- [SyncSettingsForm Component](../components/clients/SyncSettingsForm.md) — Settings form
- [SyncStatusIndicator Component](../components/clients/SyncStatusIndicator.md) — Status display
- [ClientIdentity Component](../components/clients/ClientIdentity.md) — Identity display
- [useClientSettings Composable](../composables/useClientSettings.md) — Settings management composable
- [Feature F9 Specification](../../../requirements/features/feature-0009-client-settings.md) — Original requirements
