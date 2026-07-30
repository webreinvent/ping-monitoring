import uPlot from "uplot";
import "uplot/dist/uPlot.min.css";

import { calculateTooltipPosition } from "./chart-tooltip";
import { formatDateTime, formatLatency, stateLabel } from "./i18n";
import type { HistoryPoint, HistoryResponse, QualityIntervalRecord, QualityState } from "./types";

const palette = ["#5eead4", "#60a5fa", "#c084fc", "#f472b6", "#facc15"];

/**
 * Threshold-based bar colors for latency values (ms).
 */
const barColorThresholds: [number, string][] = [
  [50, "#4ade80"],      // green — Low
  [100, "#facc15"],      // yellow — Medium
  [200, "#fb923c"],      // orange — High
  [Infinity, "#f87171"],  // red — Very High
];

interface ChartOptions {
  compact?: boolean;
  selectedTargetId?: string | null;
  onRangeChanged?: (fromMs: number, toMs: number) => void;
}

export class LatencyChart {
  private plot: uPlot | null = null;
  private resizeObserver: ResizeObserver | null = null;
  private tooltip: HTMLDivElement;
  private history: HistoryResponse | null = null;
  private selectedTargetId: string | null;
  private isLineMode = false;
  private aggregatedSeries: HistoryResponse | null = null;
  private gaps: boolean[][] = [];

  constructor(
    private readonly container: HTMLElement,
    private readonly options: ChartOptions = {},
  ) {
    this.selectedTargetId = options.selectedTargetId ?? null;
    this.tooltip = document.createElement("div");
    this.tooltip.className = "chart-tooltip";
    this.container.append(this.tooltip);
  }

  render(history: HistoryResponse, selectedTargetId = this.selectedTargetId): void {
    this.history = history;
    this.selectedTargetId = selectedTargetId ?? null;
    this.plot?.destroy();
    this.resizeObserver?.disconnect();
    this.container.querySelector(".uplot")?.remove();

    const rangeMs = history.toMs - history.fromMs;
    const allPoints = history.series.flatMap((s) => s.points);
    const totalPointCount = allPoints.length;
    // Target ~100-2000 bars for readability
    const targetBarCount = Math.max(100, Math.min(2000, Math.round(rangeMs / 500)));
    const bucketMs = getBucketSize(rangeMs, totalPointCount, targetBarCount);
    const aggregated = aggregateData(history, bucketMs);
    const { data, labels, gaps: gapsArr } = alignSeries(aggregated);
    this.aggregatedSeries = aggregated;
    this.gaps = gapsArr;

    // In bar mode with a selected monitor, null out hidden series so they don't render
    if (!this.options.compact && this.selectedTargetId) {
      const dataArr = data as number[][];
      for (let si = 0; si < aggregated.series.length; si++) {
        if (aggregated.series[si].target.id !== this.selectedTargetId) {
          dataArr[si + 1] = new Array(dataArr[si + 1].length).fill(null) as number[];
        }
      }
    }
    const actualBarCount = data[0].length;
    const width = Math.max(280, this.container.clientWidth);
    const height = Math.max(this.options.compact ? 80 : 260, this.container.clientHeight);
    const intervals = this.intervalsForDisplay(history);

    // Line mode: used when all monitors are visible (no single target selected) and not compact.
    // Bar mode: used when a single monitor is selected or in compact view.
    this.isLineMode = !this.options.compact && !this.selectedTargetId;
    const isLineMode = this.isLineMode;


    // Build bar path builder only in bar mode
    const barsPath = isLineMode
      ? undefined
      : ((uPlot.paths as any)?.bars ?? (() => () => ({ stroke: null, fill: null, clip: null }))())({
          size: [0.8, Math.max(1, Math.min(12, Math.round((width - 40) / Math.max(1, actualBarCount) * 0.8))), 1],
          gap: 0,
          radius: 0,
          disp: {
            fill: {
              unit: 3 as uPlot.Series.BarsPathBuilderFacetUnit,
              values: (_self: uPlot, seriesIdx: number, _idx0: number, _idx1: number) => {
                const result: (string | null)[] = [];
                for (let i = 0; i < data[seriesIdx].length; i++) {
                  const value = data[seriesIdx][i];
                  if (value == null) {
                    result.push(null);
                  } else if (this.gaps[seriesIdx - 1]?.[i]) {
                    result.push("rgba(148, 163, 184, 0.25)");
                  } else {
                    result.push(barColor(value as number));
                  }
                }
                return result;
              },
            },
          },
        });

    const series: uPlot.Series[] = [
      { label: "Time" },
      ...aggregated.series.map((item, index) => {
        const isSelected = item.target.id === this.selectedTargetId;
        const isHidden = !this.options.compact && this.selectedTargetId && !isSelected;
        if (isLineMode) {
          // Line mode: each monitor gets a colored line, no fill, no bars
          return {
            label: item.target.name,
            stroke: palette[index % palette.length],
            fill: "transparent",
            width: 2,
            spanGaps: true,
            points: { show: false },
            value: (_self: uPlot, rawValue: number | null) => formatLatency(rawValue),
          };
        }
        // Bar mode: threshold-colored bars
        return {
          label: item.target.name,
          stroke: isHidden ? "transparent" : palette[index % palette.length],
          fill: isHidden ? "transparent" : palette[index % palette.length],
          width: 0,
          spanGaps: false,
          points: { show: false },
          value: (_self: uPlot, rawValue: number | null) => formatLatency(rawValue),
          paths: isHidden ? undefined : barsPath,
          ...(isHidden ? { min: 0, max: 0, scale: "y2" } : {}),
        };
      }),
    ];

    const plotOptions: uPlot.Options = {
      width,
      height,
      padding: this.options.compact ? [8, 6, 4, 0] : [16, 24, 8, 12],
      scales: {
        x: { time: true },
        y: {
          auto: true,
          range: (_u, _min, max) => {
            const hi = Math.max(50, (max || 50) * 2);
            return [0, Math.ceil(hi / 10) * 10];
          },
        },
        y2: {
          auto: false,
          range: () => [0, 1],
        },
      },
      series,
      axes: this.options.compact
        ? [{ show: false }, { show: false }]
        : [
            {
              // Dynamic space: only show as many labels as can actually fit
              space: (_self: uPlot, _axisIdx: number, _min: number, _max: number, dim: number) =>
                Math.max(60, dim / 20),
              size: 32,
              stroke: "rgba(148, 163, 184, 0.36)",
              font: "11px inherit",
              label: () => "",
              ticks: {
                stroke: "rgba(148, 163, 184, 0.25)",
                size: 4,
              },
              grid: {
                stroke: "rgba(148, 163, 184, 0.07)",
                width: 1,
              },
              values: (
                self: uPlot,
                splits: number[],
                _axisIdx: number,
                _foundSpace: number,
                _foundIncr: number,
              ) => {
                const max = self.scales.x.max ?? 0;
                const min = self.scales.x.min ?? 0;
                return splits.map((s) => formatXAxis(s, max - min));
              },
            },
            {
              space: 48,
              size: 48,
              stroke: "rgba(148, 163, 184, 0.36)",
              font: "11px inherit",
              label: "ms",
              labelFont: "11px inherit",
              labelSize: 16,
              ticks: {
                stroke: "rgba(148, 163, 184, 0.25)",
                size: 4,
              },
              grid: {
                stroke: "rgba(148, 163, 184, 0.07)",
                width: 1,
              },
              // Limit Y-axis labels so they don't overlap on narrow charts
              incrs: [
                5, 10, 15, 20, 25, 50, 75, 100, 150, 200, 250, 500, 750, 1000, 2000, 5000, 10000,
              ],
              values: (
                self: uPlot,
                splits: number[],
                _axisIdx: number,
                _foundSpace: number,
                _foundIncr: number,
              ) => {
                const max = self.scales.y.max ?? 50;
                return splits.map((s) => formatYAxis(s, max));
              },
            },
          ],
      cursor: {
        drag: { x: false, y: false },
        focus: { prox: 24 },
        points: isLineMode
          ? { size: 7, width: 2, fill: (_u, seriesIdx) => palette[(seriesIdx - 1) % palette.length] }
          : { size: 7, width: 2 },
        y: false,
      },
      legend: { show: false },
      hooks: {
        drawClear: [
          (u) => {
            if (isLineMode) drawThresholdZones(u);
            drawIntervals(u, intervals, history.toMs);
          },
        ],
        setCursor: [(u) => this.updateTooltip(u, labels)],
        ready: [(u) => this.attachInteractions(u)],
      },
    };

    this.plot = new uPlot(plotOptions, data, this.container);
    this.resizeObserver = new ResizeObserver(() => {
      if (!this.plot) return;
      const nextWidth = Math.max(280, this.container.clientWidth);
      const nextHeight = Math.max(
        this.options.compact ? 80 : 260,
        this.container.clientHeight,
      );
      if (this.plot.width !== nextWidth || this.plot.height !== nextHeight) {
        this.plot.setSize({ width: nextWidth, height: nextHeight });
      }
    });
    this.resizeObserver.observe(this.container);
  }

  destroy(): void {
    this.resizeObserver?.disconnect();
    this.plot?.destroy();
    this.plot = null;
    this.tooltip.remove();
  }

  private intervalsForDisplay(history: HistoryResponse): QualityIntervalRecord[] {
    if (this.options.compact) {
      return history.series.flatMap((series) => series.intervals);
    }
    if (this.selectedTargetId === null) {
      return history.series.flatMap((series) => series.intervals);
    }
    const selected =
      history.series.find((series) => series.target.id === this.selectedTargetId) ??
      history.series[0];
    return selected?.intervals ?? [];
  }

  private updateTooltip(plot: uPlot, labels: string[]): void {
    const index = plot.cursor.idx;
    if (index == null || plot.cursor.left == null || !this.history) {
      this.tooltip.classList.remove("visible");
      return;
    }
    const timestampSeconds = plot.data[0][index];
    if (timestampSeconds == null) return;
    const timestampMs = timestampSeconds * 1_000;
    const values = labels
      .map((label, seriesIndex) => {
        const isSelected = this.history!.series[seriesIndex]?.target.id === this.selectedTargetId;
        const isHidden = !this.options.compact && this.selectedTargetId && !isSelected;
        if (isHidden) return "";
        const value = plot.data[seriesIndex + 1]?.[index];
        return value == null
          ? ""
          : `<div><span class="tooltip-swatch" style="--swatch:${palette[seriesIndex % palette.length]}"></span>${escapeHtml(label)} <strong>${formatLatency(value)}</strong></div>`;
      })
      .filter(Boolean)
      .join("");
    // Determine quality state label shown in tooltip
    let intervalText = "";
    if (this.isLineMode) {
      // Line mode: show state of the series closest to the cursor
      let closestDist = Infinity;
      let closestInterval: QualityIntervalRecord | null = null;
      for (let si = 0; si < this.history.series.length; si++) {
        const series = this.history.series[si];
        for (const item of series.intervals) {
          const end = item.endMs ?? this.history.toMs;
          if (timestampMs < item.startMs || timestampMs > end) continue;
          const val = plot.data[si + 1]?.[index];
          if (val == null) continue;
          const y = plot.valToPos(val, "y", true);
          const dist = Math.abs(y - (plot.cursor.top ?? plot.bbox.top + plot.bbox.height / 2));
          if (dist < closestDist) {
            closestDist = dist;
            closestInterval = item;
          }
        }
      }
      if (closestInterval) {
        intervalText = `<div class="tooltip-state state-${closestInterval.state}">${stateLabel(closestInterval.state)}</div>`;
      }
    } else {
      // Bar mode: derive state from the hovered bar's actual latency value,
      // not from historical intervals (which may not match the bar's data)
      const seriesIdx = this.selectedTargetId
        ? this.aggregatedSeries!.series.findIndex((s) => s.target.id === this.selectedTargetId) + 1
        : 1;
      const hoveredVal = plot.data[seriesIdx]?.[index];
      const isGap = this.gaps[seriesIdx - 1]?.[index] ?? false;
      if (isGap) {
        intervalText = `<div class="tooltip-state state-disconnected">${stateLabel("disconnected" as QualityState)}</div>`;
      } else if (hoveredVal != null && hoveredVal > 0) {
        const val = hoveredVal as number;
        const stateFromLatency: QualityState =
          val < 50
            ? "low"
            : val < 100
            ? "medium"
            : val < 200
            ? "high"
            : "veryHigh";
        intervalText = `<div class="tooltip-state state-${stateFromLatency}">${stateLabel(stateFromLatency)}</div>`;
      }
    }
    this.tooltip.innerHTML = `<time>${formatDateTime(timestampMs)}</time>${values}${intervalText}`;
    const containerRect = this.container.getBoundingClientRect();
    const overlayRect = plot.over.getBoundingClientRect();
    const anchorX = overlayRect.left - containerRect.left + plot.cursor.left;
    const anchorY =
      overlayRect.top - containerRect.top + (plot.cursor.top ?? overlayRect.height / 2);
    const position = calculateTooltipPosition({
      anchorX,
      anchorY,
      tooltipWidth: this.tooltip.offsetWidth,
      tooltipHeight: this.tooltip.offsetHeight,
      containerWidth: this.container.clientWidth,
      containerHeight: this.container.clientHeight,
    });
    this.tooltip.style.left = `${position.left}px`;
    this.tooltip.style.top = `${position.top}px`;
    this.tooltip.classList.add("visible");
  }

  private attachInteractions(plot: uPlot): void {
    if (this.options.compact) return;
    const overlay = plot.over;
    let dragging = false;
    let startX = 0;
    let startMin = 0;
    let startMax = 0;

    overlay.addEventListener("pointerdown", (event) => {
      if (event.button !== 0 || plot.scales.x.min == null || plot.scales.x.max == null) return;
      dragging = true;
      startX = event.clientX;
      startMin = plot.scales.x.min;
      startMax = plot.scales.x.max;
      overlay.setPointerCapture(event.pointerId);
      overlay.classList.add("is-panning");
    });
    overlay.addEventListener("pointermove", (event) => {
      if (!dragging) return;
      const deltaSeconds =
        ((event.clientX - startX) / Math.max(1, plot.bbox.width)) * (startMax - startMin);
      plot.setScale("x", { min: startMin - deltaSeconds, max: startMax - deltaSeconds });
    });
    const finishPan = (event: PointerEvent) => {
      if (!dragging) return;
      dragging = false;
      overlay.releasePointerCapture(event.pointerId);
      overlay.classList.remove("is-panning");
      this.reportRange(plot);
    };
    overlay.addEventListener("pointerup", finishPan);
    overlay.addEventListener("pointercancel", finishPan);
    overlay.addEventListener(
      "wheel",
      (event) => {
        if (plot.scales.x.min == null || plot.scales.x.max == null) return;
        event.preventDefault();
        const range = plot.scales.x.max - plot.scales.x.min;
        const factor = event.deltaY > 0 ? 1.25 : 0.8;
        const cursorRatio = Math.max(0, Math.min(1, event.offsetX / Math.max(1, plot.bbox.width)));
        const anchor = plot.scales.x.min + range * cursorRatio;
        const nextRange = Math.max(60, Math.min(365 * 86_400, range * factor));
        plot.setScale("x", {
          min: anchor - nextRange * cursorRatio,
          max: anchor + nextRange * (1 - cursorRatio),
        });
        window.clearTimeout((overlay as HTMLElement & { zoomTimer?: number }).zoomTimer);
        (overlay as HTMLElement & { zoomTimer?: number }).zoomTimer = window.setTimeout(
          () => this.reportRange(plot),
          180,
        );
      },
      { passive: false },
    );
  }

  private reportRange(plot: uPlot): void {
    const min = plot.scales.x.min;
    const max = plot.scales.x.max;
    if (min != null && max != null) this.options.onRangeChanged?.(min * 1_000, max * 1_000);
  }
}

function alignSeries(history: HistoryResponse): {
  data: uPlot.AlignedData;
  labels: string[];
  /** Per-series boolean arrays: true = gap (no data), false = real data */
  gaps: boolean[][];
} {
  const timestamps = Array.from(
    new Set(history.series.flatMap((series) => series.points.map((point) => point.timestampMs))),
  ).sort((a, b) => a - b);
  if (timestamps.length === 0) timestamps.push(history.fromMs, history.toMs);
  const data: uPlot.AlignedData = [timestamps.map((timestamp) => timestamp / 1_000)];
  const gaps: boolean[][] = [];

  for (const series of history.series) {
    const values = new Map<number, number>(
      series.points.map((point) => [point.timestampMs, point.averageLatencyMs!]),
    );

    // Compute the series' median latency to use as the height of gap bars
    const latencies: number[] = [];
    for (const v of values.values()) {
      if (v > 0) latencies.push(v);
    }
    latencies.sort((a, b) => a - b);
    const medianLatency =
      latencies.length > 0
        ? latencies[Math.floor(latencies.length / 2)]
        : 10;

    const gapArray: boolean[] = [];
    data.push(
      timestamps.map((timestamp) => {
        const val = values.get(timestamp);
        if (val != null) {
          gapArray.push(false);
          return val;
        }
        gapArray.push(true);
        return medianLatency;
      }),
    );
    gaps.push(gapArray);
  }

  return { data, gaps, labels: history.series.map((series) => series.target.name) };
}

/**
 * Determine the bucket size (in ms) for aggregating data based on the visible time range.
 */
function getBucketSize(rangeMs: number, pointCount: number, targetBarCount: number): number {
  // If we have fewer points than the target, don't aggregate — show each point
  if (pointCount <= targetBarCount) {
    return 0; // No aggregation — use raw data as-is
  }
  // Aggregate to reduce to target bar count
  const rawBucket = Math.max(1_000, Math.round(rangeMs / targetBarCount));
  // Round up to a clean bucket size
  const cleanSizes = [1_000, 5_000, 10_000, 30_000, 60_000, 5 * 60_000, 15 * 60_000, 30 * 60_000, 3_600_000];
  for (const size of cleanSizes) {
    if (rawBucket <= size) return size;
  }
  return 3_600_000;
}

/**
 * Aggregate HistoryResponse into coarser buckets.
 * When bucketMs is 0, returns the data unchanged (no aggregation).
 */
function aggregateData(history: HistoryResponse, bucketMs: number): HistoryResponse {
  if (bucketMs === 0) return history;
  return {
    ...history,
    series: history.series.map((series) => {
      const buckets = new Map<number, HistoryPoint[]>();
      for (const point of series.points) {
        const bucketKey = Math.floor(point.timestampMs / bucketMs) * bucketMs;
        let bucket = buckets.get(bucketKey);
        if (!bucket) {
          bucket = [];
          buckets.set(bucketKey, bucket);
        }
        bucket.push(point);
      }
      const aggregated: HistoryPoint[] = Array.from(buckets.entries())
        .sort(([a], [b]) => a - b)
        .map(([timestamp, points]) => {
          const latencies = points.map((p) => p.averageLatencyMs).filter((v) => v != null) as number[];
          const mins = points.map((p) => p.minimumLatencyMs).filter((v) => v != null) as number[];
          const maxs = points.map((p) => p.maximumLatencyMs).filter((v) => v != null) as number[];
          return {
            timestampMs: timestamp,
            averageLatencyMs: latencies.length
              ? latencies.reduce((a, b) => a + b, 0) / latencies.length
              : null,
            minimumLatencyMs: mins.length ? Math.min(...mins) : null,
            maximumLatencyMs: maxs.length ? Math.max(...maxs) : null,
            sampleCount: points.reduce((sum, p) => sum + p.sampleCount, 0),
            failureCount: points.reduce((sum, p) => sum + p.failureCount, 0),
          };
        });
      return { ...series, points: aggregated };
    }),
  };
}

/**
 * Draw threshold zone bands on the chart background (line mode only).
 * Each zone spans only its own range: 0-50ms, 50-100ms, 100-200ms, >200ms.
 */
function drawThresholdZones(plot: uPlot): void {
  const yMax = plot.scales.y.max ?? 50;
  // Threshold lines: green (50ms) → yellow (100ms) → orange (150ms) → red (200ms)
  const zones: { low: number; lineColor: string }[] = [
    { low: 200, lineColor: "#ef4444" },   // red
    { low: 150, lineColor: "#f97316" },   // orange
    { low: 100, lineColor: "#eab308" },   // yellow
    { low: 50, lineColor: "#22c55e" },    // green
  ];
  for (const zone of zones) {
    if (zone.low >= yMax) continue;
    const y = plot.valToPos(zone.low, "y", true);
    if (y < plot.bbox.top || y > plot.bbox.top + plot.bbox.height) continue;

    // Dashed threshold line
    plot.ctx.save();
    plot.ctx.strokeStyle = zone.lineColor;
    plot.ctx.lineWidth = 1;
    plot.ctx.setLineDash([8, 4]);
    plot.ctx.globalAlpha = 0.5;
    plot.ctx.beginPath();
    plot.ctx.moveTo(plot.bbox.left, y);
    plot.ctx.lineTo(plot.bbox.left + plot.bbox.width, y);
    plot.ctx.stroke();
    plot.ctx.restore();
  }
}

function drawIntervals(
  _plot: uPlot,
  _intervals: QualityIntervalRecord[],
  _fallbackEndMs: number,
): void {
  // Intervals are already communicated via the status badge — skip drawing
  // overlays on the chart to keep the background clean.
}

/**
 * Return the bar color based on latency threshold.
 */
function barColor(latencyMs: number): string {
  if (latencyMs === 0) return "rgba(148, 163, 184, 0.25)";
  for (const [threshold, color] of barColorThresholds) {
    if (latencyMs < threshold) return color;
  }
  return "#ef4444";
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>'"]/g, (character) => {
    const entities: Record<string, string> = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      "'": "&#39;",
      '"': "&quot;",
    };
    return entities[character];
  });
}

/**
 * Formats the Y axis value into a clean integer or short decimal.
 */
function formatYAxis(value: number, max: number): string {
  if (value === 0) return "0";
  if (max <= 10) return value % 1 === 0 ? String(value) : value.toFixed(1);
  if (max <= 100) return String(Math.round(value));
  if (max <= 1_000) return String(Math.round(value));
  return `${(value / 1_000).toFixed(1)}k`;
}

/**
 * Formats the X axis timestamp based on the visible time range.
 */
function formatXAxis(timestamp: number, rangeSeconds: number): string {
  const date = new Date(timestamp * 1_000);
  const hour = date.getHours();
  const minute = date.getMinutes();
  const second = date.getSeconds();

  const pad = (n: number) => String(n).padStart(2, "0");

  if (rangeSeconds <= 300) {
    // ≤5 min: show seconds
    return `${pad(hour)}:${pad(minute)}:${pad(second)}`;
  }
  if (rangeSeconds <= 3_600) {
    // ≤1 hour: show minutes
    return `${pad(hour)}:${pad(minute)}`;
  }
  if (rangeSeconds <= 86_400) {
    // ≤1 day: show hours
    return `${pad(hour)}:${pad(minute)}`;
  }
  if (rangeSeconds <= 7 * 86_400) {
    // ≤1 week: day + hour
    const day = date.getDate();
    return `${day} ${pad(hour)}h`;
  }
  // >1 week: month + day
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return `${months[date.getMonth()]} ${date.getDate()}`;
}
