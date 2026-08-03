# Page: Client Settings

**File:** `app/pages/clients/[slug]/settings.vue`
**Route:** `/clients/:slug/settings`
**Feature:** M2-T6 (Client settings page)

## Purpose

Settings page for a specific client showing the current sync status and a form to configure sync settings (enable/disable, interval, backend URL).

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
│   │   └── h3: "Sync Configuration"
│   └── SyncSettingsForm (clientSlug, initialSettings)
└── [no data state]
    └── EmptyState: "Client not found"
```

## Components Used

| Component | Purpose |
|-----------|---------|
| [NavigationBreadcrumb](../components/shared/NavigationBreadcrumb.md) | Back navigation to client overview |
| [SyncStatusIndicator](../components/clients/SyncStatusIndicator.md) | Current sync status display |
| [SyncSettingsForm](../components/clients/SyncSettingsForm.md) | Settings form with validation |
| [EmptyState](../components/shared/EmptyState.md) | Client not found fallback |

## Data Flow

1. `useAsyncData` fetches client data from `GET /api/clients/:slug`
2. `syncStatus` computed derives the status from `sync_enabled`:
   - `sync_enabled` is falsy → `"disabled"`
   - `sync_enabled` is truthy → `"connected"`
3. `initialSettings` computed transforms the API response into form-friendly values
4. `SyncSettingsForm` handles the form submission via `PUT /api/clients/:slug/settings`

### Settings Derivation

```typescript
const initialSettings = computed(() => ({
  sync_enabled: clientData.value?.sync_enabled ? true : false,
  sync_interval_min: clientData.value?.sync_interval_min ?? 5,
  backend_url: clientData.value?.backend_url ?? "",
}));
```

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
- **Sync disabled:** `SyncStatusIndicator` shows "Sync Disabled" — the form reflects the disabled state.
- **Form submission error:** The form displays the error message inline — the page does not navigate away.

## Related

- [Client Overview Page](./clients-slug.md) — Parent page
- [Client Settings API](../../api/clients-settings.md) — `PUT /api/clients/:slug/settings` endpoint
- [SyncSettingsForm Component](../components/clients/SyncSettingsForm.md) — Settings form
- [SyncStatusIndicator Component](../components/clients/SyncStatusIndicator.md) — Status display
- [Client Identity API](../../api/clients.md) — `GET /api/clients/:slug` data source
