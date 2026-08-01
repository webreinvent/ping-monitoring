---
name: agent-04-ui-ux-plan
description: Agent 04 completed UI/UX plan for LNPM Cloud Dashboard
metadata:
  type: project
  hook: UI/UX plan results from Agent 04
---

## Agent 04: Plan UI/UX Design — Complete

### Skills Installed and Invoked

1. **ui-ux-pro-max** (nextlevelbuilder/ui-ux-pro-max-skill) — installed and invoked
   - Generated design system for "network monitoring dashboard dark mode real-time"
   - Results: Real-Time/Operations Landing + Dark Mode OLED pattern
   - Chart recommendations: Streaming Area Chart for ≥1Hz data
   - Stack guidelines (nuxtjs): `useState` for shared state, auto-imports
2. **tailwind-best-practices** — evaluated, skipped (no Tailwind adoption)
3. **primevue** — evaluated, skipped (vanilla CSS approach)

### Key Decisions

- **Styling:** Vanilla CSS custom properties (no Tailwind) — port desktop app's 15+ tokens
- **State:** Vue 3 composables with `useState` (no Pinia for MVP) — 9 composables planned
- **Chart:** uPlot in Vue 3 — `onMounted`/`onUnmounted` lifecycle wrapper
- **i18n:** Custom lightweight approach ported from `src/i18n.ts` — 5 locales (en, ko, ja, zh-CN, zh-TW)
- **Icons:** Lucide (tree-shakeable, stroke-based, 16x16, 1.8px)
- **Responsive:** Desktop-first, 840px min width, tablet breakpoint at 980px
- **Accessibility:** WCAG AAA dark mode contrast, keyboard nav, ARIA labels, reduced motion

### Components Planned

~25 components across 6 categories:
- Layout (3): AppShell, AppHeader, DashboardPanel
- Sidebar (5): MonitorSidebar, ClientGroup, MonitorRow, AllMonitorsRow, SidebarResizer
- Chart (4): LatencyChart, ChartCard, ChartLegend, ChartTooltip
- Metrics (3): SummaryGrid, MetricCard, StatePill
- Shared (7): StatusDot, TimeRangeSelector, EmptyState, ToggleButton, ToastStack, IconButton, Button
- Modal (3): ClientNameDialog, CustomRangeDialog, ModalBase

### State Flow

WebSocket → useWebSocket → useMonitors → useChart → useQualityState

### References

- Full plan: [[ui-ux-design-decisions]]
- Desktop CSS: `src/styles.css` (1786 lines)
- Desktop chart: `src/chart.ts`
- Screenshot: `docs/assets/lnpm-dashboard.png`
- Agent plan: `ai-milestones-and-tasks/ui-ux-plan-agent-04.md`
