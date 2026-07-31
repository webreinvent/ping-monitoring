---
taskId: M2-T1
milestone: M2
title: Build dashboard shell with layout, sidebar structure, and routing
priority: Critical
status: "Not Started"
estimatedEffort: "2-3 hours"
features:
  - F8
---

# Task M2-T1 — Build dashboard shell with layout, sidebar structure, and routing

> **Milestone:** M2 (Dashboard UI)
> **Priority:** Critical
> **Status:** Not Started
> **Estimated Effort:** 2-3 hours

## Description

Create the Nuxt 4 app shell with default layout, routing structure, and the sidebar container. Establishes the page routes, layout structure, and base styling for the dashboard.

## Task Goals

- Create default layout with sidebar + main content area
- Set up page routes: index (all-monitors), monitors/[id] (detail), clients/[slug] (client overview)
- Create responsive layout: sidebar collapses on narrow viewports
- Create minimal app styling matching LNPM desktop design

## Implementation Plan

### Steps

1. Create `app/app.vue` with layout wrapper
2. Create `app/layouts/default.vue`:
   - Sidebar (fixed width, left side)
   - Main content area (flex-grow, right side)
   - Responsive: sidebar hides on mobile, hamburger toggle
3. Create page files:
   - `app/pages/index.vue` — all-monitors view (placeholder)
   - `app/pages/monitors/[id].vue` — per-monitor detail (placeholder)
   - `app/pages/clients/[slug].vue` — client overview (placeholder)
4. Create `app/components/layouts/DashboardSidebar.vue`:
   - Empty sidebar shell with header
5. Create `app/components/shared/EmptyState.vue`:
   - "No monitors configured" message
6. Create base styles (CSS/Tailwind or scoped)

### Skills & MCP Servers

| Resource | Purpose | When to Invoke |
|---|---|---|
| `nuxt` | Nuxt 4 layout/routing patterns | Layout, pages |
| `filesystem` (MCP) | File creation | Writing files |

## Acceptance Criteria

- [ ] Default layout renders with sidebar + main content area
- [ ] Routes work: /, /monitors/:id, /clients/:slug
- [ ] Responsive layout works on narrow viewports
- [ ] Empty state shown when no data loaded
- [ ] App matches LNPM desktop design aesthetic

## Completion Criteria

- [ ] All acceptance criteria above pass
- [ ] `npx nuxi typecheck` passes with no errors
- [ ] `npx nuxi dev` starts without errors and health endpoint returns 200

## Testing Checklist

- [ ] Pages render without errors
- [ ] Layout responsive on mobile
- [ ] Navigation works

## Dependencies

- **Requires:** M1 (all backend APIs available)
- **Blocks:** M2-T2, M2-T3

## Documentation References

- F8: [Web dashboard UI](../../requirements/features/feature-0008-web-dashboard.md) — Pages, Components, Routing
