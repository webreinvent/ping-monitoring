<template>
  <div class="chart-wrapper" ref="wrapperRef" />
</template>

<script setup lang="ts">
import uPlot from "uplot";

interface QualityBand {
  /** Start timestamp in seconds */
  start: number;
  /** End timestamp in seconds */
  end: number;
  /** Background color (CSS rgba) */
  color: string;
}

interface Props {
  /** uPlot data: column 0 is timestamps (seconds), column 1+ are values */
  data: Float64Array[];
  /** uPlot series configuration for data series (index 0 is always time) */
  seriesConfig?: uPlot.Series[];
  /** Height in pixels (default 300) */
  height?: number;
  /** Quality interval bands to render as background regions */
  qualityBands?: QualityBand[];
  /** Horizontal threshold line Y value (in ms) — single threshold (backward compat) */
  thresholdValue?: number | null;
  /** Multiple horizontal threshold lines Y values (in ms) — takes precedence over thresholdValue */
  thresholdValues?: number[];
}

const props = withDefaults(defineProps<Props>(), {
  height: 300,
  qualityBands: () => [],
  thresholdValue: null,
  thresholdValues: () => [],
});

const wrapperRef = ref<HTMLDivElement>();
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

/**
 * Compute an explicit x-scale from the data column 0 (timestamps in seconds).
 * Falls back to a generic time scale if the data is missing or empty.
 */
function computeXScale(data: Float64Array[]): { time: true; min?: number; max?: number } {
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
  const bands = props.qualityBands;
  const threshold = props.thresholdValue;
  const thresholds = props.thresholdValues.length > 0 ? props.thresholdValues : (threshold != null ? [threshold] : []);

  // Threshold color mapping — matching desktop app and design tokens
  const THRESHOLD_COLORS: Record<number, string> = {
    50: "rgba(69, 223, 194, 0.45)",    // --accent (green) — good
    100: "rgba(246, 169, 74, 0.45)",   // --warning (yellow) — caution
    150: "rgba(249, 115, 22, 0.45)",   // orange — elevated
    200: "rgba(255, 107, 120, 0.45)",  // --danger (red) — bad
  };

  // Build series array: time + data series.
  // For each non-time series, force spanGaps so NaN holes don't break the line
  // (uPlot's auto-scaler treats a fully-NaN column as having no range; spanning
  // ensures adjacent valid points still connect).
  const series: uPlot.Series[] = [
    { label: "Time" },
    ...seriesConfig.map((s) => ({ ...s, spanGaps: true })),
  ];

  const opts: Record<string, unknown> = {
    title: "",
    // Padding matches the desktop chart so axis labels have breathing room.
    padding: [16, 24, 8, 12],
    scales: {
      // Explicit x-range from the data: uPlot's auto-resolver does not always
      // run reliably when the chart is constructed with an empty/just-loaded
      // dataset (especially under SSR/hydration timing). Passing min/max
      // directly guarantees the x-axis is well-defined from the start.
      x: computeXScale(props.data),
      y: {
        auto: true,
        min: 0,
      },
    },
    series,
    axes: [
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
        // y-axis — uPlot's side enum: 0=top, 1=right, 2=bottom, 3=left
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
    ],
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
    drawClear: [
      (u: any) => {
        const ctx: CanvasRenderingContext2D | null = u.ctx;
        if (!ctx) return;
        // Scale and bbox must be initialized. If not, skip this draw frame —
        // uPlot will fire another drawClear once the layout is settled.
        if (!u.scale || !u.bbox) return;

        // Draw quality interval bands
        if (bands && bands.length > 0) {
          const { bbox, scale, toLeft } = u;
          const xScale = scale["x"];
          if (xScale) {
            for (const band of bands) {
              const x0 = toLeft(xScale, band.start);
              const x1 = toLeft(xScale, band.end);
              if (x0 >= bbox.width || x1 < 0) continue;
              const xStart = Math.max(0, x0);
              const xEnd = Math.min(bbox.width, x1);
              ctx.save();
              ctx.globalAlpha = 1;
              ctx.fillStyle = band.color;
              ctx.fillRect(xStart, bbox.top, xEnd - xStart, bbox.height);
              ctx.restore();
            }
          }
        }

        // Draw threshold lines
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
        if (yMax <= 0) return;
        const resolvedYMin = yMin === Infinity ? 0 : Math.min(0, yMin);
        const resolvedYMax = Math.ceil((yMax * 1.1) / 10) * 10;

        // Mirror the resolved y range onto the scale so valToPos is consistent
        // with our drawing math AND uPlot's axis ticks show real values.
        u.scales.y.min = resolvedYMin;
        u.scales.y.max = resolvedYMax;
        u.scales.y._min = resolvedYMin;
        u.scales.y._max = resolvedYMax;

        const pxRatio = u.pxRatio ?? 1;

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
function ensureScalesResolved(): void {
  if (!chart) return;
  let mutated = false;

  // X scale: compute min/max from data column 0 (timestamps in seconds).
  if (chart.scales.x.min == null || chart.scales.x.max == null) {
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
        chart.scales.x.min = lo;
        chart.scales.x.max = hi;
        chart.scales.x._min = lo;
        chart.scales.x._max = hi;
        mutated = true;
      }
    }
  }

  // Y scale: compute min/max from all data series (skip time column).
  if (chart.scales.y.min == null || chart.scales.y.max == null) {
    let yMin = Infinity;
    let yMax = -Infinity;
    for (let s = 1; s < props.data.length; s++) {
      const col = props.data[s];
      if (!col) continue;
      for (let i = 0; i < col.length; i++) {
        const v = col[i]!;
        if (!Number.isNaN(v) && v != null && v > 0) {
          if (v < yMin) yMin = v;
          if (v > yMax) yMax = v;
        }
      }
    }
    if (yMax > 0) {
      const min = yMin === Infinity ? 0 : Math.min(0, yMin);
      const max = Math.ceil((yMax * 1.1) / 10) * 10;
      chart.scales.y.min = min;
      chart.scales.y.max = max;
      chart.scales.y._min = min;
      chart.scales.y._max = max;
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
  // Safety net: if uPlot's auto-resolver didn't fire, force the scales to a
  // valid range via direct mutation. This is the only reliable way to recover
  // a chart whose x/y scales are stuck at null..null.
  if (chart.scales.x.min == null || chart.scales.y.max == null) {
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
  chart?.destroy();
  chart = null;
});

defineExpose({ chart, updateChart });
</script>
