---
id: F8
name: Web dashboard UI
phase: MVP
priority: High
effort: Large
dependencies: [F1, F5, F6, F7]
---

# F8: Web dashboard UI

## Description

A full-featured web dashboard UI built with Nuxt + Vue that mirrors the LNPM desktop application design. The dashboard provides a sidebar with client-grouped monitors, an all-monitors combined line chart, a per-monitor detail view with rich metrics, and live WebSocket updates via uPlot charts. This is the primary interface for users to monitor ping health across all registered clients and targets.

## Acceptance Criteria

### Scenario: Dashboard loads with sidebar
- **Given** the user navigates to the dashboard root URL (`/`)
- **When** the page loads
- **Then** the sidebar displays all registered clients grouped by client name
- **And** each client group lists its monitors with target name, current status (up/down/unknown), and a status dot (green/yellow/red)
- **And** the sidebar fetches data from `GET /api/monitors` (F5)

### Scenario: All-monitors combined line chart
- **Given** the dashboard is loaded and multiple monitors exist
- **When** the user views the default "All Monitors" view
- **Then** a single uPlot line chart renders with all monitors as separate series
- **And** each series is assigned a distinct color from the dashboard palette
- **And** the chart shows latency over time with the default time window (last 1 hour)
- **And** the chart uses the same `HistoryPoint` aggregation (from F6) for each monitor
- **And** monitors can be toggled on/off via sidebar checkboxes, showing or hiding their series

### Scenario: Per-monitor detail view
- **Given** the user clicks on a monitor in the sidebar
- **When** the detail view loads
- **Then** a dedicated uPlot chart renders with that monitor's historical data (from `GET /api/monitors/:id`, F6)
- **And** quality intervals are rendered as colored bands overlaying the chart
- **And** the RangeSummary metrics (packet loss, avg/min/max/p95 latency, stable/unstable/disconnected percent) are displayed in a summary panel
- **And** the monitor's current state (latest latency, status, resolved address) is shown as a header

### Scenario: Live WebSocket updates
- **Given** the user is viewing any chart (all-monitors or per-monitor)
- **When** a new ping sample arrives via WebSocket (F7)
- **Then** the chart updates in real-time with the new data point
- **And** the sidebar status dot updates to reflect the latest state
- **And** the update is smooth (no full page reload, incremental uPlot data push)

### Scenario: Sidebar client grouping and toggle
- **Given** multiple clients with multiple monitors each
- **When** the user views the sidebar
- **Then** monitors are grouped under their client name as collapsible sections
- **And** clicking a client group header expands or collapses that group
- **And** each monitor row has a toggle to show/hide it in the all-monitors chart
- **And** clicking a monitor row navigates to its detail view

### Scenario: Time window controls
- **Given** the user is viewing any chart view
- **When** the user selects a time range preset (1h, 6h, 24h, 7d)
- **Then** the chart re-queries history data (F6) for the selected window
- **And** the chart re-renders with the new data

### Scenario: Responsive layout
- **Given** the dashboard is loaded on different screen sizes
- **When** the viewport width changes
- **Then** the sidebar collapses to an icon-only or hidden state on narrow viewports
- **And** the chart area fills the remaining space
- **And** a hamburger menu toggles the sidebar on mobile

### Scenario: Empty state
- **Given** no monitors exist in the database
- **When** the dashboard loads
- **Then** an empty state message is displayed: "No monitors configured. Start by registering a client."
- **And** the sidebar is empty with no client groups

### Scenario: Monitor status colors
- **Given** monitors with various states
- **When** the dashboard renders
- **Then** status dots use the following colors:
  - **Green**: `qualityState` is `low` or `medium` (healthy)
  - **Yellow**: `qualityState` is `high` or `veryHigh` (degraded)
  - **Red**: `qualityState` is `unstable`, `disconnected`, or `error` (poor)
  - **Gray**: `qualityState` is `warmingUp`, `unobserved`, or `null` (unknown)

### Scenario: Auto-reconnect with chart recovery
- **Given** a WebSocket connection drops while viewing a chart
- **When** the client auto-reconnects (F7 backoff logic)
- **Then** the chart receives a fresh snapshot and re-renders with current data
- **And** any data gaps during the disconnection are filled by the snapshot

## Implementation Notes

### Frontend architecture (Nuxt + Vue)

The dashboard is a client-side SPA rendered by Nuxt (SSR for initial load, then client-side navigation). All chart rendering uses uPlot, and all real-time updates arrive via WebSocket.

#### Pages

| Page | Route | Description |
|------|-------|-------------|
| `pages/index.vue` | `/` | Dashboard home — all-monitors view with sidebar and combined chart |
| `pages/monitors/[id].vue` | `/monitors/:id` | Per-monitor detail view with dedicated chart and metrics |
| `pages/clients/[slug]/index.vue` | `/clients/:slug` | Client overview (all monitors for a client) |

#### Components

| Component | File | Description |
|-----------|------|-------------|
| `DashboardSidebar` | `components/DashboardSidebar.vue` | Sidebar with client groups, monitor list, toggles |
| `ClientGroup` | `components/sidebars/ClientGroup.vue` | Collapsible client group section |
| `MonitorRow` | `components/sidebars/MonitorRow.vue` | Single monitor row with status dot, name, toggle |
| `StatusDot` | `components/shared/StatusDot.vue` | Colored status indicator (green/yellow/red/gray) |
| `LatencyChart` | `components/charts/LatencyChart.vue` | uPlot-based latency chart (reused from existing `src/chart.ts`) |
| `AllMonitorsChart` | `components/charts/AllMonitorsChart.vue` | Multi-series chart for all-monitors view |
| `TimeRangeSelector` | `components/shared/TimeRangeSelector.vue` | Preset time range buttons (1h, 6h, 24h, 7d) |
| `QualityIntervals` | `components/charts/QualityIntervals.vue` | Quality interval bands overlay on chart |
| `MonitorSummary` | `components/charts/MonitorSummary.vue` | RangeSummary metrics panel (packet loss, latency stats) |
| `MonitorHeader` | `components/charts/MonitorHeader.vue` | Monitor title bar with current state |
| `EmptyState` | `components/shared/EmptyState.vue` | Empty state message for no monitors |
| `ChartThreshold` | `components/charts/ChartThreshold.vue` | Threshold line overlay (e.g., latency threshold) |

#### Composables

| Composable | File | Description |
|------------|------|-------------|
| `useMonitors` | `composables/useMonitors.ts` | Fetch and cache monitors list from `GET /api/monitors` |
| `useMonitorHistory` | `composables/useMonitorHistory.ts` | Fetch history data from `GET /api/monitors/:id` with time window params |
| `useWebSocket` | `composables/useWebSocket.ts` | WebSocket connection management, subscribe/unsubscribe, auto-reconnect |
| `useChartSeries` | `composables/useChartSeries.ts` | Transform `HistoryPoint[]` into uPlot-ready series data |
| `useTimeWindow` | `composables/useTimeWindow.ts` | Manage selected time range, compute `fromMs`/`toMs` |
| `useDashboardPalette` | `composables/useDashboardPalette.ts` | Categorical color assignment for monitor series |

#### Reusing existing code

The existing `src/chart.ts` already contains chart logic (bucketing, uPlot rendering). The dashboard will import and wrap this existing code into Vue components. The `src/types.ts` types (`HistoryResponse`, `HistoryPoint`, `QualityIntervalRecord`, `RangeSummary`) are the canonical shapes the frontend consumes.

### Backend integration

- **Monitors list**: `GET /api/monitors` (F5) — fetched on dashboard load and periodically (or pushed via WS)
- **Monitor history**: `GET /api/monitors/:id` (F6) — fetched when opening detail view or changing time range
- **All-monitors chart data**: Each monitor's history fetched individually via F6, then combined client-side
- **WebSocket**: `/ws/ping` (F7) — subscribe to monitors for live updates
- **No new API endpoints**: F8 consumes existing endpoints from F5, F6, and F7

### Chart rendering (uPlot)

The uPlot chart configuration follows these patterns:

- **All-monitors chart**: Multiple series, one per monitor. Each series gets a color from the dashboard palette. Threshold lines rendered as additional series.
- **Per-monitor chart**: Single series with quality interval bands. Uses the same `HistoryPoint` data structure from F6.
- **Live updates**: On WebSocket `sample` messages, push new data points into uPlot's series data arrays and call `update()`.
- **Quality intervals**: Rendered as background zones using uPlot's `bands` or custom plugin.
- **Threshold lines**: Horizontal lines at configured threshold values (from `QualityThresholds.p95LatencyMs`).

### Color palette

Monitor series colors are assigned from a fixed palette (categorical, brand-neutral). The palette supports at least 12 distinct colors for simultaneous monitors. Dark mode uses the same hues with adjusted lightness.

```ts
const SERIES_COLORS = [
  '#3b82f6', // blue-500
  '#ef4444', // red-500
  '#10b981', // emerald-500
  '#f59e0b', // amber-500
  '#8b5cf6', // violet-500
  '#ec4899', // pink-500
  '#06b6d4', // cyan-500
  '#f97316', // orange-500
  '#14b8a6', // teal-500
  '#6366f1', // indigo-500
  '#84cc16', // lime-500
  '#e11d48', // rose-600
];
```

### Routing

```
/                              -> All-monitors view (default)
/monitors/:id                  -> Per-monitor detail view
/clients/:slug                 -> Client overview (all monitors for a client)
/clients/:slug/settings        -> Client settings (F9, separate feature)
```

### State management

- Use Pinia for global state (monitors list, selected monitor, WS connection state)
- Chart data is component-local (fetched by composables, stored in ref/reactive)
- Sidebar state (collapsed groups, toggled monitors) persisted in localStorage

### Performance considerations

- **All-monitors chart**: Fetch history for each monitor in parallel. Use `maxPoints` param (F6) to limit data transfer.
- **WebSocket messages**: Throttle uPlot updates to avoid per-sample re-render. Batch incoming samples and update at 1s intervals.
- **Sidebar polling**: Do not poll `GET /api/monitors` — rely on WebSocket updates to refresh status. Initial fetch only on load.
- **Lazy loading**: Lazy-load per-monitor detail view (`defineAsyncComponent`) to avoid bundling chart logic for the sidebar-only initial render.

## Data Model Changes

No new tables or columns. This feature consumes existing data models:

- `clients` — `id`, `slug`, `name`, `username`, `hostname`, `mac_address`
- `monitors` — `id`, `client_id`, `target_host`, `target_name`
- `ping_samples` — `id`, `monitor_id`, `timestamp_ms`, `latency_ms`, `status`, `resolved_address`, `error`

## API Contract

F8 does not introduce new API endpoints. It consumes the following existing contracts:

### Consumed endpoints

| Method | Endpoint | Feature | Purpose |
|--------|----------|---------|---------|
| GET | `/api/monitors` | F5 | Fetch all monitors for sidebar |
| GET | `/api/monitors/:id` | F6 | Fetch history data for charts |
| WS | `/ws/ping` | F7 | Subscribe to live updates |

### WebSocket subscription pattern

On dashboard load, the client subscribes to all visible monitors:

```json
// Client -> Server (subscribe to each monitor)
{ "type": "subscribe", "monitorId": 1 }
{ "type": "subscribe", "monitorId": 2 }
{ "type": "subscribe", "monitorId": 3 }
```

On navigation to a per-monitor detail view, subscribe to that specific monitor if not already subscribed. On navigation away, unsubscribe to reduce server load.

### Frontend data shapes (TypeScript — matches `src/types.ts`)

The frontend consumes `HistoryResponse` directly from F6:

```ts
// Chart data transformation (useChartSeries composable)
function historyToUPlotData(series: HistorySeries): number[][] {
  return series.points.map((p) => [
    p.timestampMs / 1000, // uPlot expects seconds
    p.averageLatencyMs ?? null,
  ]);
}

// Quality intervals -> uPlot bands
function historyToBands(series: HistorySeries): uPlot.Band[][] {
  return series.intervals.map((interval) => ({
    values: [
      [interval.startMs / 1000, interval.endMs / 1000],
    ],
    // color mapped from interval.state
  }));
}
```

### Error handling

- **Failed monitors fetch**: Display an error banner "Could not load monitors. Retrying..." with an automatic retry after 5 seconds.
- **Failed history fetch**: Display "Could not load chart data" with a retry button.
- **WebSocket disconnect**: Show a subtle "Reconnecting..." indicator in the header. Chart data does not clear during reconnect.
- **404 on monitor detail**: Redirect to the all-monitors view with a message "Monitor not found."
