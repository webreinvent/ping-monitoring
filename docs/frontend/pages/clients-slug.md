# Page: Client Overview

**File:** `app/pages/clients/[slug]/index.vue`
**Route:** `/clients/:slug`
**Feature:** M2-T1 (Dashboard shell), M2-T6 (Client overview page)

## Purpose

Overview page for a specific client showing identity information and a list of monitors. Provides navigation to the client's settings page.

## Usage

This page is rendered by Nuxt's file-based routing at `/clients/:slug`. It renders inside the `default` layout.

### Navigation

```vue
<!-- From sidebar (ClientGroup component) -->
<NuxtLink :to="`/clients/${group.clientSlug}`">{{ group.clientName }}</NuxtLink>
```

## Structure

```
clients/[slug]/index.vue (.client-overview-page)
├── NavigationBreadcrumb (label="All Monitors", to="/")
├── [loading state]
│   └── "Loading client data..."
├── [data state]
│   ├── .page-heading
│   │   └── h2: client name
│   ├── ClientInfo (identity fields)
│   ├── .page-heading
│   │   └── h3: "Monitors"
│   └── ClientMonitors (monitor list)
└── [no data state]
    └── EmptyState: "Client not found"
```

## Components Used

| Component | Purpose |
|-----------|---------|
| [NavigationBreadcrumb](../components/shared/NavigationBreadcrumb.md) | Back navigation to All Monitors |
| [ClientInfo](../components/clients/ClientInfo.md) | Client identity card |
| [ClientMonitors](../components/clients/ClientMonitors.md) | Monitor list for this client |
| [EmptyState](../components/shared/EmptyState.md) | Client not found fallback |

## Data Flow

1. `useAsyncData` fetches client data from `GET /api/clients/:slug`
2. `useMonitors()` provides the full monitors list
3. A computed property filters monitors by `clientSlug` to show only this client's monitors

```typescript
const clientMonitors = computed(() =>
  monitors.value.filter((m) => m.clientSlug === slug.value)
);
```

## Head

Dynamic page title based on the client name:

```typescript
useHead({
  title: computed(() => `Client — ${clientData.value?.name ?? slug.value}`),
});
```

## Data Attributes

| Attribute | Element | Purpose |
|-----------|---------|---------|
| `data-testid="client-overview-page"` | Page container | E2E test selector |

## Sub-Routes

| Route | Component | Description |
|-------|-----------|-------------|
| `/clients/:slug` | `clients/[slug]/index.vue` | Client overview (this page) |
| `/clients/:slug/settings` | `clients/[slug]/settings.vue` | [Client Settings Page](./clients-slug-settings.md) |

## Edge Cases

- **Client not found:** The API returns 404 — `EmptyState` is shown with "Client not found".
- **No monitors for client:** `ClientMonitors` shows `EmptyState` with "No monitors for this client".
- **Client with one monitor:** Renders normally with a single `MonitorRow`.

## Related

- [Client Settings Page](./clients-slug-settings.md) — Sub-route for settings
- [Client Identity API](../../api/clients.md) — Data source
- [ClientInfo Component](../components/clients/ClientInfo.md) — Identity display
- [ClientMonitors Component](../components/clients/ClientMonitors.md) — Monitor list
- [useMonitors Composable](../composables/useMonitors.md) — Monitors data source
- [Shared Types](../../shared/types.md) — `MonitorListItem` type
