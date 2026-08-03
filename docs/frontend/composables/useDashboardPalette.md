# Composable: useDashboardPalette

**File:** `app/composables/useDashboardPalette.ts`
**Feature:** M2-T3 (All-monitors chart)

## Purpose

Provides a 12-color palette for chart series in multi-monitor uPlot charts. Colors are chosen for distinguishability against the dark theme. Used to assign a consistent color to each monitor series.

## API

### `getPaletteColor(index: number): string`

Returns a hex color string from the palette by index. Wraps around using modulo if the index exceeds the palette length.

**Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `index` | `number` | Zero-based index into the palette |

**Returns:** `string` — Hex color value (e.g., `"#3b82f6"`)

**Example:**

```typescript
import { getPaletteColor } from "~/composables/useDashboardPalette";

const color1 = getPaletteColor(0);  // "#3b82f6" (blue-500)
const color2 = getPaletteColor(1);  // "#ef4444" (red-500)
const color13 = getPaletteColor(12); // "#3b82f6" (wraps around)
```

### `useDashboardPalette(): readonly string[]`

Returns the full palette array for iteration.

**Returns:** `readonly string[]` — Array of 12 hex color strings

**Example:**

```typescript
import { useDashboardPalette } from "~/composables/useDashboardPalette";

const palette = useDashboardPalette();
// palette.length === 12
```

## Palette Colors

| Index | Color | Tailwind Name | Hex |
|-------|-------|---------------|-----|
| 0 | Blue | blue-500 | `#3b82f6` |
| 1 | Red | red-500 | `#ef4444` |
| 2 | Emerald | emerald-500 | `#10b981` |
| 3 | Amber | amber-500 | `#f59e0b` |
| 4 | Violet | violet-500 | `#8b5cf6` |
| 5 | Pink | pink-500 | `#ec4899` |
| 6 | Cyan | cyan-500 | `#06b6d4` |
| 7 | Orange | orange-500 | `#f97316` |
| 8 | Teal | teal-500 | `#14b8a6` |
| 9 | Indigo | indigo-500 | `#6366f1` |
| 10 | Lime | lime-500 | `#84cc16` |
| 11 | Rose | rose-600 | `#e11d48` |

## Usage

```typescript
// Assign colors to monitor series
const seriesConfig = monitors.value.map((m, i) => ({
  label: m.targetName,
  stroke: getPaletteColor(i),
  width: 1.5,
  points: { show: false },
}));
```

## Edge Cases

- **Negative index:** JavaScript modulo with negative numbers returns negative — `getPaletteColor(-1)` returns `DASHBOARD_PALETTE[-1 % 12]` which is `DASHBOARD_PALETTE[-1]` (undefined), falling back to `DASHBOARD_PALETTE[0]`. Callers should ensure non-negative indices.
- **Index beyond palette:** Wraps around via modulo — index 12 returns the same color as index 0.
- **Non-integer index:** Modulo still works, but the result is a float index. JavaScript arrays handle float indices by truncating, so `getPaletteColor(2.7)` returns `DASHBOARD_PALETTE[2]`.

## Related

- [AllMonitorsChart Component](../components/charts/AllMonitorsChart.md) — Primary consumer
- [LatencyChart Component](../components/charts/LatencyChart.md) — Receives series config with colors
