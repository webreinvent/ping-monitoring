<template>
  <div class="chart-wrapper" ref="wrapperRef">
    <!-- Hover tooltip: innerHTML-driven, so its children never receive the
         scoped data-v attribute — styles live in the global charts.css. -->
    <div class="chart-tooltip" ref="tooltipRef" aria-hidden="true" />
  </div>
</template>

<script setup lang="ts">
import uPlot from "uplot";

import { BAR_GAP_FILL, barFillColor, medianLatencyFill } from "~/utils/bars";
import { calculateTooltipPosition } from "~/utils/chart-tooltip";

interface Props {
  /** uPlot data: column 0 is timestamps (seconds), column 1+ are values */
  data: Float64Array[];
  /** uPlot series configuration for data series (index 0 is always time) */
  seriesConfig?: uPlot.Series[];
  /** Height in pixels (default 300) */
  height?: number;
  /**
   * Render mode. `"line"` (default) draws connected latency lines with
   * optional threshold guides. `"bars"` draws threshold-colored latency bars
   * whose fills are identical to the desktop (Tauri) chart's bar mode — used
   * by the single-monitor detail view. Bars mode suppresses threshold guides
   * and any secondary axes, and applies the bar-mode y-scale headroom.
   */
  mode?: "line" | "bars";
  /** Multiple horizontal threshold lines Y values (in ms) — line mode only */
  thresholdValues?: number[];
  /**
   * Optional explicit x-window in seconds [min, max]. When supplied, the
   * chart anchors to these bounds instead of computing from the data column.
   * Used by live mode where the trailing 60s window must always be visible,
   * even when only a handful of samples have arrived so far.
   */
  windowSec?: [number, number];
  /**
   * Optional per-series display names for the hover tooltip (index 0 = first
   * data series). Falls back to the uPlot series label when omitted.
   */
  labels?: string[];
}

const props = withDefaults(defineProps<Props>(), {
  height: 300,
  mode: "line",
  thresholdValues: () => [],
  windowSec: undefined,
  labels: () => [],
});

const wrapperRef = ref<HTMLDivElement>();
const tooltipRef = ref<HTMLDivElement>();
let chart: uPlot | null = null;

function formatXAxisTick(value: number, rangeSeconds: number): string {
  const date = new Date(value * 1000);
  const pad = (n: number) => String(n).padStart(2, "0");
  const hour = date.getHours();
  const minute = date.getMinutes();
  const day = date.getDate();
  const month = date.toLocaleString("en", { month: "short" });

  if (rangeSeconds <= 300) return `${pad(hour)}:${pad(minute)}:${pad(date.getSeconds())}`;
  if (rangeSeconds <= 86_400) return `${pad(hour)}:${pad(minute)}`;
  if (rangeSeconds <= 7 * 86_400) return `${day} ${pad(hour)}h`;
  return `${month} ${day}`;
}

function formatYAxisTick(value: number, max: number): string {
  if (value === 0) return "0";
  if (max <= 10) return value % 1 === 0 ? String(value) : value.toFixed(1);
  return String(Math.round(value));
}

// ---------------------------------------------------------------------------
// Hover tooltip — mirrors the desktop (Tauri) chart's tooltip: timestamp,
// one value row per visible series (swatch + label + latency), and a
// threshold-derived latency state line for single-series charts.
// ---------------------------------------------------------------------------

const TOOLTIP_STATE_LABELS: Record<string, string> = {
  low: "Low",
  medium: "Medium",
  high: "High",
  veryHigh: "Very High",
  unstable: "Unstable",
  disconnected: "Disconnected",
};

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/'/g, "&#39;")
    .replace(/"/g, "&quot;");
}

function formatLatency(value: number | null): string {
  if (value == null) return "—";
  const num = new Intl.NumberFormat("en", {
    maximumFractionDigits: value < 10 ? 1 : 0,
  }).format(value);
  return `${num} ms`;
}

function formatDateTime(ms: number): string {
  return new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeStyle: "medium",
  }).format(new Date(ms));
}

/** Threshold-derived latency state (mirrors the desktop app's bar-mode tooltip). */
function stateFromLatency(value: number | null): string {
  if (value == null || Number.isNaN(value)) return "disconnected";
  if (value < 50) return "low";
  if (value < 100) return "medium";
  if (value < 200) return "high";
  return "veryHigh";
}

function hideTooltip(): void {
  tooltipRef.value?.classList.remove("visible");
}

/**
 * uPlot `setCursor` hook — fires on every cursor move AND when the cursor is
 * cleared (idx → null), so this one handler covers both show and hide.
 */
function updateTooltip(u: uPlot): void {
  const tooltip = tooltipRef.value;
  const wrapper = wrapperRef.value;
  if (!tooltip || !wrapper) return;

  const index = u.cursor.idx ?? null;
  if (index == null || u.cursor.left == null) {
    hideTooltip();
    return;
  }

  const data = u.data as Float64Array[];
  const ts = data[0]?.[index];
  if (ts == null || Number.isNaN(ts)) {
    hideTooltip();
    return;
  }

  const seriesCount = data.length - 1;
  let rows = "";
  for (let si = 1; si < data.length; si++) {
    const value = data[si]?.[index];
    if (value == null || Number.isNaN(value)) continue;
    const series = u.series[si];
    // uPlot types `label` as `string | HTMLElement` — only strings are usable.
    const seriesLabel = typeof series?.label === "string" ? series.label : undefined;
    const label = props.labels?.[si - 1] ?? seriesLabel ?? "Latency";
    // `_stroke` is uPlot's internal cached stroke (not in the public type) —
    // same access pattern as the draw hook above.
    const internal = series as unknown as { _stroke?: string } | undefined;
    let color = typeof internal?._stroke === "string" ? internal._stroke : null;
    // Bars mode paints series strokes transparent (manual draw) — fall back to
    // the accent so the swatch still identifies the series.
    if (!color || color === "transparent") color = "#45dfc2";
    rows += `<div class="tooltip-row"><span class="tooltip-swatch" style="--swatch:${color}"></span>${escapeHtml(label)} <strong>${formatLatency(value)}</strong></div>`;
  }
  if (!rows) {
    hideTooltip();
    return;
  }

  // State line only for single-series charts (the detail view) — with many
  // series a per-hover quality state would be ambiguous.
  let stateHtml = "";
  if (seriesCount === 1) {
    const value = data[1]?.[index];
    const state = stateFromLatency(value == null ? null : value);
    stateHtml = `<div class="tooltip-state state-${state}">Latency: ${TOOLTIP_STATE_LABELS[state] ?? state}</div>`;
  }

  tooltip.innerHTML = `<time>${formatDateTime(ts * 1000)}</time>${rows}${stateHtml}`;
  tooltip.classList.add("visible");

  // Position relative to the wrapper (the tooltip's offset parent).
  const wrapperRect = wrapper.getBoundingClientRect();
  const overRect = (u.over as HTMLElement).getBoundingClientRect();
  const anchorX = overRect.left - wrapperRect.left + u.cursor.left;
  const anchorY = overRect.top - wrapperRect.top + (u.cursor.top ?? overRect.height / 2);
  const position = calculateTooltipPosition({
    anchorX,
    anchorY,
    tooltipWidth: tooltip.offsetWidth,
    tooltipHeight: tooltip.offsetHeight,
    containerWidth: wrapper.clientWidth,
    containerHeight: wrapper.clientHeight,
  });
  tooltip.style.left = `${position.left}px`;
  tooltip.style.top = `${position.top}px`;
}

/**
 * Compute an explicit x-scale from the data column 0 (timestamps in seconds).
 * Falls back to a generic time scale if the data is missing or empty.
 * When `windowSec` is provided (live mode), the bounds are taken from it
 * directly — the trailing 60s window must always be visible, even when only
 * a handful of samples have arrived so far.
 */
function computeXScale(data: Float64Array[]): { time: true; min?: number; max?: number } {
  if (props.windowSec) {
    const [lo, hi] = props.windowSec;
    const span = Math.max(1, hi - lo);
    return {
      time: true,
      min: lo - span * 0.005,
      max: hi + span * 0.005,
    };
  }
  const ts = data[0];
  if (!ts || ts.length === 0) {
    return { time: true };
  }
  let lo = Infinity;
  let hi = -Infinity;
  for (let i = 0; i < ts.length; i++) {
    const v = ts[i]!;
    if (!Number.isNaN(v)) {
      if (v < lo) lo = v;
      if (v > hi) hi = v;
    }
  }
  if (!Number.isFinite(lo) || !Number.isFinite(hi) || hi <= lo) {
    return { time: true };
  }
  // Pad the range slightly so data points don't sit right on the axis edges.
  const span = hi - lo;
  return {
    time: true,
    min: lo - span * 0.005,
    max: hi + span * 0.005,
  };
}

function buildOptions(): Record<string, unknown> {
  const seriesConfig = props.seriesConfig ?? [];
  const thresholds = props.mode === "line" ? props.thresholdValues : [];

  // Threshold color mapping — matching desktop app and design tokens
  const THRESHOLD_COLORS: Record<number, string> = {
    50: "rgba(69, 223, 194, 0.45)",    // --accent (green) — good
    100: "rgba(246, 169, 74, 0.45)",   // --warning (yellow) — caution
    150: "rgba(249, 115, 22, 0.45)",   // orange — elevated
    200: "rgba(255, 107, 120, 0.45)",  // --danger (red) — bad
  };

  // Build series array: time + data series.
  // Bars mode suppresses uPlot's native series drawing entirely (transparent
  // stroke, zero width, no points) — all geometry is drawn manually in the
  // draw hook below, mirroring the desktop chart's bar-mode fills. Line mode
  // forces spanGaps so NaN holes don't break the line (uPlot's auto-scaler
  // treats a fully-NaN column as having no range; spanning ensures adjacent
  // valid points still connect).
  const series: uPlot.Series[] =
    props.mode === "bars"
      ? [
          { label: "Time" },
          {
            label: "Latency",
            stroke: "transparent",
            fill: "transparent",
            width: 0,
            spanGaps: false,
            points: { show: false },
          },
        ]
      : [
          { label: "Time" },
          ...seriesConfig.map((s) => ({ ...s, spanGaps: true })),
        ];

  // Scales: x + y (latency). Bars mode applies headroom in the draw hook so
  // bars occupy roughly the lower half of the plot (matching Tauri's
  // bar-mode y-scale); line mode keeps the tighter auto range.
  const scales: Record<string, unknown> = {
    x: computeXScale(props.data),
    y: {
      auto: true,
      min: 0,
    },
  };

  // Axes: x-axis + left y-axis (latency ms)
  const axes: Array<Record<string, unknown>> = [
    {
      // x-axis
      stroke: "rgba(148, 176, 194, 0.36)",
      font: "11px Inter, ui-sans-serif, system-ui, sans-serif",
      ticks: { stroke: "rgba(148, 176, 194, 0.25)", size: 4 },
      grid: { stroke: "rgba(148, 176, 194, 0.07)", width: 1 },
      values: (
        _self: uPlot,
        splits: number[],
        _axisIdx: number,
      ) => {
        const max = splits[splits.length - 1] ?? 0;
        const min = splits[0] ?? 0;
        return splits.map((s) => formatXAxisTick(s, max - min));
      },
    },
    {
      // y-axis (left) — latency in ms
      stroke: "rgba(148, 176, 194, 0.36)",
      font: "11px Inter, ui-sans-serif, system-ui, sans-serif",
      label: "ms",
      labelFont: "11px Inter, ui-sans-serif, system-ui, sans-serif",
      labelSize: 16,
      size: 56,
      side: 3,
      ticks: { stroke: "rgba(148, 176, 194, 0.25)", size: 4 },
      grid: { stroke: "rgba(148, 176, 194, 0.07)", width: 1 },
      incrs: [5, 10, 25, 50, 100, 200, 500, 1000],
      values: (
        _self: uPlot,
        splits: number[],
        _axisIdx: number,
      ) => {
        const max = splits[splits.length - 1] ?? 50;
        return splits.map((s) => formatYAxisTick(s, max));
      },
    },
  ];


  const opts: Record<string, unknown> = {
    title: "",
    // Padding matches the desktop chart so axis labels have breathing room.
    padding: [16, 24, 8, 12],
    scales,
    series,
    axes,
    cursor: {
      x: true,
      y: true,
      points: {
        size: 7,
        width: 2,
        fill: "rgba(69, 223, 194, 0.1)",
        stroke: "#45dfc2",
      },
      drag: { x: true, y: false },
    },
    legend: { show: false },
  };

  // Hooks: uPlot calls hooks[eventName] for each entry. Use the object form
  // (matching Tauri's chart.ts). We render quality bands, threshold lines,
  // and CRITICALLY — manual data line drawing — because uPlot's internal
  // path generator produces an empty Path2D for our dynamically-built
  // multi-series merged data. Bypassing uPlot's path builder and drawing
  // polylines via valToPos guarantees the visualization always renders.
  opts.hooks = {
    setCursor: [
      (u: uPlot) => {
        updateTooltip(u);
      },
    ],

    drawClear: [
      (u: any) => {
        const ctx: CanvasRenderingContext2D | null = u.ctx;
        if (!ctx) return;
        // Scale and bbox must be initialized. If not, skip this draw frame —
        // uPlot will fire another drawClear once the layout is settled.
        if (!u.scale || !u.bbox) return;

        // Draw threshold lines (line mode only — bars mode renders no guides)
        if (thresholds.length > 0) {
          const { bbox, scale, toBottom } = u;
          const yScale = scale["y"];
          if (yScale) {
            for (const tv of thresholds) {
              const y = toBottom(yScale, tv);
              if (y < bbox.top || y > bbox.top + bbox.height) continue;
              const color = THRESHOLD_COLORS[tv] ?? "rgba(239, 68, 68, 0.6)";
              ctx.save();
              ctx.strokeStyle = color;
              ctx.lineWidth = 1;
              ctx.setLineDash([8, 4]);
              ctx.beginPath();
              ctx.moveTo(0, y);
              ctx.lineTo(bbox.width, y);
              ctx.stroke();
              ctx.restore();
            }
          }
        }
      },
    ],

    draw: [
      (u: any) => {
        // Manual data line drawing — bypasses uPlot's path builder entirely.
        // For each non-time series, walk the column and draw a polyline with
        // computed canvas pixel positions. Uses ctx.save/restore to avoid
        // interfering with uPlot's other drawings.
        const ctx: CanvasRenderingContext2D | null = u.ctx;
        if (!ctx) return;
        // Need the x-scale at minimum (for valToPos).
        if (!u.scales || !u.scales.x) return;
        const xScaleMin = u.scales.x.min;
        const xScaleMax = u.scales.x.max;
        if (xScaleMin == null || xScaleMax == null) return;
        const data = u.data as Float64Array[];
        if (!data || data.length < 2) return;
        const xs = data[0];
        if (!xs || xs.length === 0) return;

        // Compute y-range from the data on every draw. uPlot's auto-resolver
        // sometimes leaves `scales.y.max = null` (e.g. when setData() is called
        // before the chart's first user interaction), which would otherwise
        // produce a blank canvas. Computing the range inline keeps the chart
        // renderable under all conditions; we then mutate `scales.y` to a
        // rounded value so uPlot's axis labels remain sensible.
        let yMin = Infinity;
        let yMax = -Infinity;
        for (let si = 1; si < data.length; si++) {
          const ys = data[si];
          if (!ys) continue;
          for (let i = 0; i < ys.length; i++) {
            const v = ys[i]!;
            if (v != null && !Number.isNaN(v) && v > 0) {
              if (v < yMin) yMin = v;
              if (v > yMax) yMax = v;
            }
          }
        }
        if (yMax <= 0 && props.mode !== "bars") return;
        const resolvedYMin = yMin === Infinity ? 0 : Math.min(0, yMin);
        // Bars mode applies headroom (2× max, minimum 50, rounded up to 10ms)
        // so bars occupy roughly the lower half of the plot — matching
        // Tauri's bar-mode y-scale. Line mode keeps the tighter 10% headroom.
        const rawMax = yMax <= 0 ? 0 : yMax;
        const resolvedYMax =
          props.mode === "bars"
            ? Math.ceil(Math.max(50, rawMax * 2) / 10) * 10
            : Math.ceil((yMax * 1.1) / 10) * 10;

        // Mirror the resolved y range onto the scale so valToPos is consistent
        // with our drawing math AND uPlot's axis ticks show real values.
        u.scales.y.min = resolvedYMin;
        u.scales.y.max = resolvedYMax;
        u.scales.y._min = resolvedYMin;
        u.scales.y._max = resolvedYMax;

        const pxRatio = u.pxRatio ?? 1;

        if (props.mode === "bars") {
          // Bars mode — threshold-colored bars with fills identical to the
          // desktop (Tauri) chart's bar mode. Buckets without a usable
          // latency (NaN) render as gray bars at the median-fill height;
          // zero-latency buckets draw nothing (matching the desktop).
          const ys = data[1];
          if (!ys || ys.length === 0) return;
          const median = medianLatencyFill(ys);
          const plotWidth = u.bbox?.width ?? 0;
          // valToPos(..., true) returns ABSOLUTE canvas-device coordinates —
          // they include the left axis offset (bbox.left). The off-plot cull
          // must therefore be measured against [bbox.left, bbox.left +
          // bbox.width], not [0, bbox.width]; otherwise the rightmost bars
          // (those past bbox.width in absolute space) are silently skipped,
          // leaving a blank band along the right edge as wide as the y-axis.
          const bboxLeft = u.bbox?.left ?? 0;
          const bboxRight = bboxLeft + plotWidth;
          const barWidth = Math.max(
            1,
            Math.min(
              12,
              Math.round(((plotWidth - 40) / Math.max(1, xs.length)) * 0.8),
            ),
          );
          const yBase = u.valToPos(0, "y", true);
          for (let i = 0; i < xs.length; i++) {
            const t = xs[i]!;
            const v = ys[i]!;
            if (t == null || Number.isNaN(t)) continue;
            const x = u.valToPos(t, "x", true);
            if (x < bboxLeft - barWidth || x > bboxRight + barWidth) continue;
            if (v == null || Number.isNaN(v)) {
              const yTop = u.valToPos(median, "y", true);
              ctx.save();
              ctx.fillStyle = BAR_GAP_FILL;
              ctx.fillRect(x - barWidth / 2, yTop, barWidth, Math.max(1, yBase - yTop));
              ctx.restore();
              continue;
            }
            if (v === 0) continue;
            const yTop = u.valToPos(v, "y", true);
            ctx.save();
            ctx.fillStyle = barFillColor(v);
            ctx.fillRect(x - barWidth / 2, yTop, barWidth, Math.max(1, yBase - yTop));
            ctx.restore();
          }
          return;
        }

        for (let si = 1; si < data.length; si++) {
          const ys = data[si];
          if (!ys) continue;
          const s = u.series[si];
          // Resolve stroke color from cached series state or fallback.
          const strokeColor: string =
            (typeof s?._stroke === "string" ? s._stroke : null) ??
            (typeof s?.stroke === "string" ? s.stroke : null) ??
            "#5eead4";
          const lineWidth = (s?.width ?? 1.5) * pxRatio;

          ctx.save();
          ctx.strokeStyle = strokeColor;
          ctx.lineWidth = lineWidth;
          ctx.lineJoin = "round";
          ctx.lineCap = "round";

          let began = false;
          for (let i = 0; i < ys.length; i++) {
            const yVal = ys[i]!;
            if (yVal == null || Number.isNaN(yVal)) {
              if (began) {
                ctx.stroke();
                began = false;
                ctx.beginPath();
              }
              continue;
            }
            const xVal = xs[i]!;
            if (xVal == null || Number.isNaN(xVal)) continue;
            const xPx = u.valToPos(xVal, "x", true);
            const yPx = u.valToPos(yVal, "y", true);
            if (!began) {
              ctx.beginPath();
              ctx.moveTo(xPx, yPx);
              began = true;
            } else {
              ctx.lineTo(xPx, yPx);
            }
          }
          if (began) ctx.stroke();
          ctx.restore();
        }
      },
    ],
  };

  return opts;
}

function rebuildChart(): void {
  if (!wrapperRef.value) return;
  const width = wrapperRef.value.clientWidth ?? 800;
  if (width === 0) return;

  // A fresh chart has no cursor — drop any stale tooltip before rebuilding.
  hideTooltip();

  // Tear down any existing chart — uPlot's column count is locked at construction
  if (chart) {
    chart.destroy();
    chart = null;
  }

  const opts = {
    ...buildOptions(),
    width: width as number,
    height: props.height,
  } as unknown as uPlot.Options;

  chart = new uPlot(opts, props.data, wrapperRef.value);
  // Force an explicit scale reset so the y-range callback runs even on the
  // first render — uPlot's lazy auto-resolver otherwise leaves y at null..null
  // until the user pans/zooms.
  chart.redraw(true);

  // Final safety net: if scales are still null after construction (which can
  // happen when the data column is empty or all-NaN on first mount), directly
  // mutate the scale properties. We use direct property mutation instead of
  // chart.setScale() because uPlot's setScale API has been observed to be a
  // no-op when called against a chart whose auto-resolver never fired. The
  // underlying property assignment + redraw(true) reliably forces the chart
  // into a renderable state.
  ensureScalesResolved();
}

/**
 * Forcefully resolve any null scale values by computing them directly from the
 * data. uPlot's setScale() / auto-resolver can leave a chart in a state where
 * scales are null..null (no data drawn, no axis ticks). Mutating
 * `chart.scales.<key>.min/max` and calling `redraw(true)` is the only known
 * reliable way to recover.
 */
// uPlot's public Scale type omits the internal `_min`/`_max` fields it uses
// for scale caching; direct-mutation recovery has to write those too, so we
// widen the type locally instead of casting at every mutation site.
type ScaleInternal = uPlot.Scale & { _min?: number | null; _max?: number | null };

function ensureScalesResolved(): void {
  if (!chart) return;
  let mutated = false;
  const xScale = chart.scales.x as ScaleInternal | undefined;
  const yScale = chart.scales.y as ScaleInternal | undefined;
  if (!xScale || !yScale) return;

  // X scale: prefer windowSec (live mode) then compute from data column 0.
  if (xScale.min == null || xScale.max == null) {
    if (props.windowSec) {
      const [lo, hi] = props.windowSec;
      if (hi > lo) {
        xScale.min = lo;
        xScale.max = hi;
        xScale._min = lo;
        xScale._max = hi;
        mutated = true;
      }
    } else {
      const ts = props.data[0];
      if (ts && ts.length > 0) {
        let lo = Infinity;
        let hi = -Infinity;
        for (let i = 0; i < ts.length; i++) {
          const v = ts[i]!;
          if (!Number.isNaN(v)) {
            if (v < lo) lo = v;
            if (v > hi) hi = v;
          }
        }
        if (Number.isFinite(lo) && Number.isFinite(hi) && hi > lo) {
          xScale.min = lo;
          xScale.max = hi;
          xScale._min = lo;
          xScale._max = hi;
          mutated = true;
        }
      }
    }
  }

  // Y scale: compute min/max from the latency series only (column 1).
  if (yScale.min == null || yScale.max == null) {
    let yMin = Infinity;
    let yMax = -Infinity;
    const latencyCol = props.data[1];
    if (latencyCol) {
      for (let i = 0; i < latencyCol.length; i++) {
        const v = latencyCol[i]!;
        if (!Number.isNaN(v) && v != null && v > 0) {
          if (v < yMin) yMin = v;
          if (v > yMax) yMax = v;
        }
      }
    }
    if (yMax > 0) {
      const min = yMin === Infinity ? 0 : Math.min(0, yMin);
      const max =
        props.mode === "bars"
          ? Math.ceil(Math.max(50, yMax * 2) / 10) * 10
          : Math.ceil((yMax * 1.1) / 10) * 10;
      yScale.min = min;
      yScale.max = max;
      yScale._min = min;
      yScale._max = max;
      mutated = true;
    }
  }


  if (mutated) {
    chart.redraw(true);
  }
}

function updateChart(): void {
  if (!chart) {
    rebuildChart();
    return;
  }
  // If the column count changed (e.g. new monitor became visible), rebuild.
  const prevCols = chart.data?.length ?? 0;
  const nextCols = props.data.length;
  if (prevCols !== nextCols) {
    rebuildChart();
    return;
  }
  // Push the new data in. The reset flag forces uPlot's auto-resolver to
  // re-run — without it, uPlot may keep stale null..null scales.
  chart.setData(props.data, true);
  // Live mode: the trailing window advances with every sample, but uPlot's
  // x-scale was locked to the bounds baked in at (re)build time — setData()
  // never moves an explicitly-set scale. Re-apply the current windowSec
  // bounds (same 0.5% padding as computeXScale) so the window tracks the
  // data instead of freezing while newer bars flow off the right edge.
  if (props.windowSec) {
    const [lo, hi] = props.windowSec;
    const span = Math.max(1, hi - lo);
    const min = lo - span * 0.005;
    const max = hi + span * 0.005;
    const xScale = chart.scales.x as ScaleInternal | undefined;
    if (xScale && (xScale.min !== min || xScale.max !== max)) {
      xScale.min = min;
      xScale._min = min;
      xScale.max = max;
      xScale._max = max;
      chart.redraw(true);
    }
  }
  // Safety net: if uPlot's auto-resolver didn't fire, force the scales to a
  // valid range via direct mutation. This is the only reliable way to recover
  // a chart whose x/y scales are stuck at null..null.
  if (chart.scales.x?.min == null || chart.scales.y?.max == null) {
    ensureScalesResolved();
  }
}

// Initialize on mount (client-side only)
let resizeObserver: ResizeObserver | null = null;

onMounted(() => {
  nextTick(() => {
    rebuildChart();
  });

  if (wrapperRef.value) {
    // ResizeObserver also initializes the chart on the first non-zero width
    // — `rebuildChart` early-returns if the wrapper isn't laid out yet, which
    // can happen when the chart is mounted before its parent's flex layout settles.
    resizeObserver = new ResizeObserver(() => {
      if (!wrapperRef.value) return;
      const width = wrapperRef.value.clientWidth;
      if (width === 0) return;
      if (!chart) {
        rebuildChart();
        return;
      }
      chart.setSize({ width, height: props.height });
    });
    resizeObserver.observe(wrapperRef.value);
  }
});

onBeforeUnmount(() => {
  resizeObserver?.disconnect();
  hideTooltip();
  chart?.destroy();
  chart = null;
});

// NOTE: `chart` is a mutable `let`, so the exposed property must be a getter —
// a plain `{ chart }` captures its value (null) at defineExpose() time.
defineExpose({ get chart() { return chart; }, updateChart });
</script>
