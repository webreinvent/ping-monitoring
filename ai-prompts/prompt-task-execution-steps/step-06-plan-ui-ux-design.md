---
step: 6
title: Plan UI/UX Design
phase: Preparation & Planning
---

# Step 6: Plan UI/UX Design

**Purpose:** Define the UI/UX approach for any user-facing changes before implementation.

## Stack Branching

### Dashboard tasks (full UI/UX planning)

1. **Load the UI/UX design reference** if one exists at `{{DOCS_DIR}}/ui-ux-plan.md` — read it for established design decisions.

2. **Identify the pages/components affected:**
   - Pages: `dashboard/app/pages/` (`index.vue`, `monitors/[id].vue`, `clients/[slug]/index.vue`, `clients/[slug]/settings.vue`).
   - Components: `dashboard/app/components/{feature}/` — auto-imported without path prefix.

3. **Define the component plan:**
   - For each new/modified component: name (PascalCase), feature group, props, emits, scoped CSS.
   - Use `<script setup lang="ts">` (Composition API).
   - Add `data-testid` attributes for E2E hooks.
   - Use `useHead()` for page titles.
   - CSS: plain scoped CSS with design tokens from `dashboard/app/assets/css/dashboard.css`. No Tailwind, no PrimeVue.

4. **Chart changes (uPlot):**
   - Existing: `LatencyChart.vue`, `AllMonitorsChart.vue`, `MonitorHeader.vue`, `MonitorSummary.vue`.
   - uPlot Qual plugin for quality bands, Point plugin for threshold lines.
   - `useLiveChart` bridges WS samples → bounded `Float64Array` (cap 2000 pts) → rAF-debounced updates.

5. **State management:**
   - Vue composables + `ref`/`computed`. No Pinia.
   - `useWebSocket` for live data; `useMonitors` persists visible set to `localStorage`.

### Tauri tasks (lighter UI check)

1. **Check `src/main.ts`** — the entire desktop UI is built imperatively with `innerHTML` template literals.
2. **Note any new DOM elements, event listeners, or Tauri event handlers** the task requires.
3. **Check `src/styles.css`** for existing CSS to reuse.
4. **If the task changes window layout or popup view**, note the impact on `src-tauri/tauri.conf.json` window definitions (requires user confirmation to modify).

### Cross-stack tasks

- Plan both dashboard and Tauri UI changes above.
- Ensure visual consistency between the two UIs where they overlap (e.g., quality-state colors).

## Memory Entry

- Title: `LNPM — {{TASK_ID}} UI/UX Plan`
- Tags: `ui-ux-plan`, `{{TASK_ID}}`
- Content: component list, chart changes, state changes, CSS approach, `data-testid` plan.

## Completion Criteria

- [ ] UI/UX approach defined (stack-appropriate depth)
- [ ] Component plan documented
- [ ] CSS approach confirmed (plain scoped CSS, no framework)
- [ ] `data-testid` attributes planned (dashboard)
- [ ] Memory entry created
