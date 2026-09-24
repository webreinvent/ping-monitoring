# Task M3-T1 — Match Tauri chart with dashboard chart

> **Milestone:** M3 (Tauri Client Enhancement)
> **Priority:** High
> **Status:** ⚪ Not Started
> **Estimated Effort:** 4-6 hours

## Description

Update the Tauri desktop client's uPlot `LatencyChart` (`src/chart.ts`) to visually match the LNPM Cloud Dashboard's `LatencyChart.vue`. The dashboard chart uses a 12-color palette, line-only rendering, rgba threshold lines, quality-band background fills, and specific axis/cursor configurations. The Tauri chart currently uses a 5-color palette, bar mode (single-monitor/compact), hex threshold colors, and disabled quality intervals. Aligning these makes the desktop app feel like a first-class client of the cloud dashboard.

## Task Goals

- Replace the 5-color palette with the dashboard's 12-color palette
- Remove bar mode; use line-only rendering in all views
- Match threshold line colors (rgba, not hex)
- Enable quality interval band rendering (background fills)
- Match font, padding, cursor, and Y-axis configuration
- Update unit tests to reflect new chart configuration

## Implementation Plan

> ⚠️ Analyze this plan thoroughly before implementing. Invoke relevant skills and MCP servers as needed.

### Pre-Implementation Analysis

- Review `src/chart.ts` (645 lines) and `dashboard/app/components/charts/LatencyChart.vue` side by side
- Review `dashboard/app/composables/useDashboardPalette.ts` for the canonical 12-color palette
- Review `dashboard/app/utils/quality-bands.ts` for band color/alpha values
- Identify all call sites of `LatencyChart` in `src/main.ts` to ensure options are passed correctly
- Check if the manual-draw workaround (dashboard bypasses uPlot's path builder) is needed in Tauri — the dashboard does this due to a uPlot bug with merged multi-series data; Tauri's `alignSeries` has the same pattern

### Steps

1. **Update palette** — Replace the 5-color `palette` constant in `src/chart.ts` with the dashboard's 12-color palette:
   ```
   ["#3b82f6","#ef4444","#10b981","#f59e0b","#8b5cf6","#ec4899","#06b6d4","#f97316","#14b8a6","#6366f1","#84cc16","#e11d48"]
   ```
   Update all references (bar colors, tooltip swatches, cursor points, line strokes).

2. **Remove bar mode** — Delete the `barsPath` builder, `barColorThresholds`, and `barColor` function. Remove the `isLineMode` conditional branching. All series render as lines with `spanGaps: true`, `width: 1.5`, `points: { show: false }`. Remove the `y2` scale (hidden series workaround) since there's no longer a "hidden" bar mode.

3. **Update threshold colors** — Replace hex threshold colors in `drawThresholdZones` with the dashboard's rgba values:
   ```
   50:  "rgba(69,223,194,0.45)"   // green
   100: "rgba(246,169,74,0.45)"   // yellow
   150: "rgba(249,115,22,0.45)"   // orange
   200: "rgba(255,107,120,0.45)"  // red
   ```

4. **Enable quality bands** — Replace the no-op `drawIntervals` with actual rendering: fill background rectangles per quality state using the dashboard's band colors (from `quality-bands.ts`). Map quality states to rgba fill colors with alpha ~0.10–0.20. Use `plot.valToPos(startMs/1000, "x", true)` and `plot.valToPos(endMs/1000, "x", true)` for x-coordinates.

5. **Match axis configuration** — Update font to `"11px Inter, ui-sans-serif, system-ui, sans-serif"`, Y-axis size to 56, cursor points to `{ size: 7, width: 2, fill: "rgba(69,223,194,0.1)", stroke: "#45dfc2" }`.

6. **Match Y-axis range** — Replace the custom `range: [0, ceil(max(50, max*2)/10)*10]` with `min: 0, auto: true` (natural uPlot auto-scale from 0).

7. **Update `main.ts` call sites** — Where `LatencyChart` is instantiated, ensure options reflect the line-only mode (remove any `compact` or `selectedTargetId` options that triggered bar mode).

8. **Update/add unit tests** — Verify palette length is 12, verify no bar-related functions exist, verify threshold colors are rgba strings.

### Skills & MCP Servers

| Resource | Purpose | When to Invoke |
|---|---|---|
| `sequential-thinking` | Step decomposition | Multi-step chart refactor |
| `nuxt` | Dashboard reference patterns | When reading dashboard Vue component code |
| `filesystem` (MCP) | File creation / modification | Reading/writing `src/chart.ts`, `src/main.ts` |

## Acceptance Criteria

- [ ] `src/chart.ts` uses the 12-color dashboard palette
- [ ] No bar-mode code remains in `src/chart.ts` (no `barsPath`, `barColorThresholds`, `barColor`)
- [ ] All series render as lines with `spanGaps: true`, `width: 1.5`
- [ ] Threshold lines use rgba colors matching dashboard values
- [ ] Quality interval bands render as background fills (not a no-op)
- [ ] Font is `"11px Inter, ui-sans-serif, system-ui, sans-serif"`
- [ ] Y-axis uses `min: 0, auto: true` (no custom doubling range)
- [ ] Cursor points have `fill: "rgba(69,223,194,0.1)", stroke: "#45dfc2"`
- [ ] `npx vitest run` (or equivalent) passes all chart tests
- [ ] Visual comparison: Tauri chart and dashboard chart look the same for the same data

## Completion Criteria

- [ ] All acceptance criteria above pass
- [ ] `cargo test` passes with no errors (Rust side unchanged, but verify)
- [ ] `npx vitest run` passes with no errors (Tauri frontend tests)
- [ ] `npx tsc --noEmit` passes with no type errors
- [ ] Manual verification: open Tauri app and dashboard side-by-side; charts look consistent

## Testing Checklist

- [ ] Unit tests written for new palette constant (length 12, correct hex values)
- [ ] Unit tests written for threshold color mapping (rgba values)
- [ ] Unit tests written for quality band rendering (correct fill rects per state)
- [ ] Bar-mode code removal verified by grep (no references to `barsPath`, `barColor`, `barColorThresholds`)
- [ ] Visual regression: screenshot comparison of Tauri chart vs dashboard chart with identical data

## Sub Tasks

| SubTask ID | Title | Status | Test Required | Priority |
|---|---|---|---|---|
| M3-T1-01 | Update palette to 12 colors | ⚪ Not Started | ✅ Yes | High |
| M3-T1-02 | Remove bar mode (line-only) | ⚪ Not Started | ✅ Yes | High |
| M3-T1-03 | Update threshold colors to rgba | ⚪ Not Started | ✅ Yes | Medium |
| M3-T1-04 | Enable quality band rendering | ⚪ Not Started | ✅ Yes | High |
| M3-T1-05 | Match axis/cursor/font configuration | ⚪ Not Started | ⚠️ Visual | Medium |
| M3-T1-06 | Update main.ts call sites | ⚪ Not Started | ⚠️ Visual | Medium |
| M3-T1-07 | Update/add unit tests | ⚪ Not Started | ✅ Yes | High |

## Dependencies

- **Requires:** None (M1, M2 complete — dashboard chart is the reference)
- **Blocks:** None

## Documentation References

- `dashboard/app/components/charts/LatencyChart.vue` — dashboard chart component (reference)
- `dashboard/app/composables/useDashboardPalette.ts` — 12-color palette
- `dashboard/app/utils/quality-bands.ts` — quality band colors
- `src/chart.ts` — Tauri chart component (to modify)
- `src/main.ts` — Tauri main entry (call sites)
- `src/chart-tooltip.ts` — tooltip (may need palette updates)
- `requirements/features/feature-0008-web-dashboard.md` — chart rendering requirements

## Notes

- The dashboard uses a manual-draw workaround (bypasses uPlot's path builder) due to a uPlot bug with merged multi-series data. Evaluate whether the Tauri chart needs the same workaround after the refactor. If `alignSeries` produces the same merged-data pattern, the manual-draw approach may be necessary.
- The Tauri chart currently has a `compact` mode (smaller, fewer axes). Decide whether to keep compact mode (for tray/mini view) or unify with the main chart. If kept, it should still use the 12-color palette and line-only rendering.
