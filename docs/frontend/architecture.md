# Frontend Architecture — LNPM Cloud Dashboard

**Framework:** Nuxt 4 + Vue 3 + TypeScript (strict mode)
**Styling:** Custom CSS with design variables (no component library)
**Charts:** uPlot (coming in M2-T2)
**State Management:** Vue composables with `useAsyncData` (no Pinia/Vuex)

## Overview

The frontend is structured around a shell layout with a persistent sidebar and content area. Data flows from API endpoints into composables, which expose reactive, grouped data structures to Vue components. The architecture follows a **composable-first** pattern: business logic lives in composables, components handle rendering, and pages orchestrate composition.

## Directory Structure

```
dashboard/app/
├── assets/css/
│   └── dashboard.css              # Global styles, CSS variables, breakpoints
├── components/
│   ├── layout/
│   │   └── DashboardHeader.vue    # Top header bar (brand, hamburger, connection status)
│   ├── sidebars/
│   │   ├── ClientGroup.vue        # Collapsible client group with monitor list
│   │   └── MonitorRow.vue        # Single monitor row (clickable link to detail)
│   ├── shared/
│   │   ├── EmptyState.vue         # No monitors placeholder (radar animation)
│   │   ├── NavigationBreadcrumb.vue  # Back navigation link
│   │   └── StatusDot.vue          # Quality state color indicator
│   └── DashboardSidebar.vue       # Main sidebar with client groups + monitor list
├── composables/
│   ├── useMonitors.ts             # Fetches & groups monitors by client
│   └── useResponsiveSidebar.ts    # Mobile detection, sidebar open/close state
├── layouts/
│   └── default.vue                # Shell: header + sidebar + main content grid
├── pages/
│   ├── index.vue                  # All Monitors (root path `/`)
│   ├── monitors/[id].vue          # Monitor detail (`/monitors/:id`)
│   └── clients/[slug]/index.vue   # Client overview (`/clients/:slug`)
└── app.vue                        # Root component, renders `<NuxtLayout>` + `<NuxtPage>`
```

## Component Hierarchy

```
app.vue
└── <NuxtLayout> (default.vue)
    ├── DashboardHeader
    │   └── hamburger button → toggles useResponsiveSidebar.isOpen
    └── .workspace (grid)
        ├── DashboardSidebar
        │   ├── All Monitors row (links to `/`)
        │   ├── ClientGroup (×N)
        │   │   └── MonitorRow (×N)
        │   │       ├── StatusDot
        │   │       └── target name + host + latency
        │   └── EmptyState (when no monitors)
        ├── .sidebar-resizer (desktop only)
        └── .main-content
            └── <slot> → NuxtPage
                ├── index.vue (All Monitors page)
                ├── monitors/[id].vue (Monitor detail)
                └── clients/[slug]/index.vue (Client overview)
```

## Routing

Nuxt file-based routing maps the `pages/` directory:

| Route | Page File | Description |
|-------|-----------|-------------|
| `/` | `pages/index.vue` | All Monitors dashboard (primary view) |
| `/monitors/:id` | `pages/monitors/[id].vue` | Single monitor detail view |
| `/clients/:slug` | `pages/clients/[slug]/index.vue` | Client overview page |

All pages render within the `default` layout, providing the persistent header and sidebar.

## Data Flow

```
API (GET /api/monitors)
    ↓
useMonitors() [composable]
    ↓ (reactive: monitors[], groupedByClient[])
DashboardSidebar [component]
    ↓ (props)
ClientGroup [component]
    ↓ (props)
MonitorRow [component]
    ↓ (props)
StatusDot [component]
```

### Data Fetching

- `useMonitors()` uses Nuxt's `useAsyncData()` to fetch monitors from `GET /api/monitors`
- Data is grouped by `clientSlug` into a `MonitorGroup[]` for sidebar rendering
- SSR-enabled: data is fetched on the server during initial render, then hydrated client-side
- No client-side polling at this stage; F7 (WebSocket) will provide real-time updates

## Responsive Design

- **Desktop (>980px):** Fixed 320px sidebar + resizable divider + main content (CSS grid)
- **Mobile (≤980px):** Sidebar hidden, hamburger button in header, fixed overlay sidebar with backdrop
- `useResponsiveSidebar()` composable manages `isMobile` (window resize) and `isOpen` (mobile overlay toggle)
- CSS media query at `max-width: 980px` handles the structural change
- Sidebar auto-closes on navigation (via `router.afterEach` in `useResponsiveSidebar`)

## Design Patterns

### Composable-First

All data fetching, grouping, and reactive state logic lives in composables. Components receive props and render — they don't fetch data directly. This makes components testable and composable logic reusable.

### CSS Variables Theme

Design tokens live in `:root` CSS variables (see [CSS Design System](./css-design.md)). No Tailwind, no component library — pure CSS with custom properties for consistent theming across the dashboard, matching the LNPM desktop app aesthetic.

### Quality State Color Mapping

Quality state colors are rendered via CSS class names (`state-veryHigh`, `state-high`, etc.) on the `StatusDot` component. Color values are defined in CSS, not inline — keeping them centralized and themeable.

### Empty State Pattern

When no monitors exist, components show `EmptyState` with a radar animation and "No monitors configured" message. This is consistent across the sidebar and any page that depends on monitor data.

## Nuxt Configuration

Key frontend-relevant settings from `nuxt.config.ts`:

| Setting | Value | Purpose |
|---------|-------|---------|
| `ssr` | `true` | Server-side rendering for initial load |
| `typescript.strict` | `true` | Full type safety |
| `devServer.port` | `3000` | Development server port |
| `css` | `~/assets/css/dashboard.css` | Global stylesheet |
| `routeRules["/api/**"]` | `{ cors: true }` | CORS for API routes |
| `app.head.title` | `"LNPM Cloud Dashboard"` | Default page title |
| `app.head.link` | Inter font preload | Google Fonts (Inter, weights 400-700) |

## TypeScript

- Strict mode enabled globally
- Shared types from `shared/types.ts` imported explicitly (not auto-imported) — Nuxt auto-imports only pick up functions and constants
- Component props are typed with inline `interface Props` + `defineProps<Props>()` pattern
- Composables return typed objects with `computed()` wrappers for reactivity

## Chart Placeholder

All pages currently show a "coming soon" placeholder for chart content. The chart implementation (uPlot integration) is the next milestone (M2-T2). Placeholder styling uses the `.chart-placeholder` CSS class with a minimum height of 300px and gradient background matching the theme.

## Related

- [CSS Design System](./css-design.md) — CSS variables, breakpoints, design tokens
- [Default Layout](./layout/default.md) — Layout shell structure
- [Composables](./composables/) — `useMonitors`, `useResponsiveSidebar`
- [Components](./components/) — All Vue component docs
- [Pages](./pages/) — Route pages
- [Cloud Dashboard Design](../../cloud-dashboard-design.md) — Original design specification
- [Feature F8 Specification](../../requirements/features/feature-0008-web-dashboard.md) — Dashboard UI requirements
