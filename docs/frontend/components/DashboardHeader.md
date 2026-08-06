# Component: DashboardHeader

**File:** `app/components/layout/DashboardHeader.vue`
**Feature:** M2-T1 (Dashboard shell), M2-T8 (API endpoint display)

## Purpose

Top header bar of the dashboard displaying the brand mark, navigation hamburger (mobile), API endpoint URL with copy button, and connection status indicator. Provides the visual anchor for the dashboard shell and surfaces the ingest endpoint URL for Tauri client setup.

## Props

None.

## Events

None.

## Slots

None.

## Usage

```vue
<!-- Used inside default layout — no direct usage needed -->
<DashboardHeader />
```

## Structure

```
DashboardHeader (.dashboard-header)
├── .brand-block
│   ├── .hamburger-btn (mobile only) → calls toggle()
│   ├── .brand-mark (LNPM clock icon)
│   └── Text: "LNPM" + "Cloud Dashboard"
├── .api-endpoint (ClientOnly)
│   ├── .api-endpoint-label "API endpoint"
│   ├── .api-endpoint-url <code> (auto-detected URL)
│   ├── .copy-btn (📋 → ✓ on copy)
│   └── .sr-only (aria-live region for screen readers)
└── .connection-status (ClientOnly)
    ├── .connection-dot (pulsing green dot when connected)
    └── "Live" label
```

## Visual Elements

### Brand Mark

- SVG clock icon inside a bordered square (34×34px)
- Accent-colored border and background with subtle transparency
- Matches LNPM desktop app branding

### API Endpoint Display (M2-T8)

- Pill-shaped container between brand block and connection status
- **"API endpoint"** label in uppercase muted text
- **URL** rendered in monospace `<code>` with ellipsis truncation (`max-width: 480px`)
- **Copy button** (📋 icon) — copies full URL to clipboard on click
- **Visual feedback**: Icon changes to ✓ for 1.5s after successful copy
- **Auto-detected URL**: Uses `useRequestURL()` to construct `${protocol}//${host}/api/ping/ingest` — no env vars needed
- **Clipboard fallback**: `textarea + document.execCommand("copy")` for non-secure contexts (localhost without HTTPS)
- **SSR-safe**: Wrapped in `<ClientOnly>` with static fallback (label only, no URL or button)
- **Accessibility**: `aria-label` on button, `aria-pressed` for copy state, `aria-live="polite"` live region for screen readers

### Connection Status

- Shows a dot + "Live" label on the right side
- Dot color:
  - **Gray (default):** Not connected yet (no WebSocket)
  - **Green with glow:** Connected (`.connected` class)
- Uses `useWebSocket()` composable for reactive connection state

### Hamburger Button

- Only visible on mobile (`display: none` on desktop, `display: grid` at `max-width: 980px`)
- 3-line icon inside bordered square (34×34px)
- Hover state: light background + brighter text
- Calls `toggle()` from `useResponsiveSidebar()` on click

## Script Logic

### `ingestUrl` (computed)

```typescript
const ingestUrl = computed(() => {
  const u = useRequestURL();
  return `${u.protocol}//${u.host}/api/ping/ingest`;
});
```

Auto-detects the full URL from the current request. Works on any deployment (localhost, LAN IP, reverse-proxy) without configuration.

### `copyIngestUrl()` (async function)

1. Tries `navigator.clipboard.writeText(ingestUrl.value)` (secure contexts)
2. Falls back to `textarea + document.execCommand("copy")` (non-secure contexts)
3. Sets `copied = true` and `copyStatusText = "Copied!"`
4. Resets to `false` / `""` after 1500ms via `setTimeout`

## Data Attributes

| Attribute | Element | Purpose |
|-----------|---------|---------|
| `data-testid="dashboard-header"` | `.dashboard-header` | E2E test selector |

## Accessibility

- Hamburger button: `aria-label="Toggle sidebar"`
- Copy button: `aria-label="Copy API endpoint URL"` / `"Copied"`, `aria-pressed="true/false"`
- Live region: `<span class="sr-only" aria-live="polite">` announces "Copied!" to screen readers
- Brand text: `<h1>` element for document heading hierarchy

## Mobile Responsive

- At `< 768px`: API endpoint label (`.api-endpoint-label`) is hidden — URL and copy button remain visible
- At `< 980px`: Hamburger button appears, sidebar becomes mobile overlay

## Related

- [useResponsiveSidebar](../composables/useResponsiveSidebar.md) — Provides `toggle()` function
- [useWebSocket](../composables/useWebSocket.md) — Provides `connectionState` reactive ref
- [Default Layout](../layout/default.md) — Consumer
- [CSS Design System](../css-design.md) — Header styling, `.hamburger-btn` mobile visibility
- [Ping Ingest API](../../api/ping-ingest.md) — The endpoint displayed (`POST /api/ping/ingest`)
