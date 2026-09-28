# Page: All Monitors (Index)

**File:** `app/pages/index.vue`
**Route:** `/`
**Feature:** M2-T1 (Dashboard shell), M2-T3 (All-monitors chart)

## Purpose

The primary dashboard page showing the "All Monitors" view. Renders a combined multi-series chart with all monitors and a time range selector for filtering the time window.

## Usage

This page is rendered by Nuxt's file-based routing at the root path `/`. It renders inside the `default` layout, which provides the header and sidebar.

## Structure

```
index.vue (.dashboard-page)
├── .page-heading
│   ├── h2: "All Monitors"
│   └── TimeRangeSelector (v-model="timeWindow")
└── AllMonitorsChart (data-testid="all-monitors-chart")
```

## Components Used

| Component | Purpose |
|-----------|---------|
| [TimeRangeSelector](../components/shared/TimeRangeSelector.md) | Time window preset selection (1h, 6h, 24h, 7d) |
| [AllMonitorsChart](../components/charts/AllMonitorsChart.md) | Combined multi-series uPlot chart |

## Data Flow

1. `useMonitors()` fetches the monitors list from `GET /api/monitors`
2. `useTimeWindow()` provides the selected time preset (persisted to localStorage)
3. `AllMonitorsChart` fetches history data for each monitor using the current time window
4. Changes to the time range selector trigger a re-fetch in `AllMonitorsChart`

## Head

Sets the page title via `useHead`:

```typescript
useHead({ title: "LNPM Cloud Dashboard — All Monitors" });
```

## Data Attributes

| Attribute | Element | Purpose |
|-----------|---------|---------|
| `data-testid="dashboard-page"` | Page container | E2E test selector |
| `data-testid="monitor-section"` | `.page-heading` | E2E section selector |
| `data-testid="monitors-heading"` | `<h2>` heading | E2E heading selector |
| `data-testid="time-range-selector"` | TimeRangeSelector | E2E time range selector |
| `data-testid="all-monitors-chart"` | AllMonitorsChart | E2E chart selector |

## Edge Cases

- **No monitors:** `AllMonitorsChart` renders an `EmptyState` with "No data to display".
- **All monitors have no data:** The chart component shows `EmptyState` — no empty chart is rendered.

## Related

- [Default Layout](../layout/default.md) — Surrounds this page with header + sidebar
- [Monitors API](../../api/monitors.md) — Data source for monitor list
- [Monitors History API](../../api/monitors-history.md) — Data source for charts
- [AllMonitorsChart Component](../components/charts/AllMonitorsChart.md) — Chart component
- [useTimeWindow Composable](../composables/useTimeWindow.md) — Time window management
