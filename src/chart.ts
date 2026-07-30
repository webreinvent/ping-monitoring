import uPlot from "uplot";
import "uplot/dist/uPlot.min.css";

import { calculateTooltipPosition } from "./chart-tooltip";
import { formatDateTime, formatLatency, stateLabel } from "./i18n";
import type { HistoryPoint, HistoryResponse, QualityIntervalRecord } from "./types";

const palette = ["#5eead4", "#60a5fa", "#c084fc", "#f472b6", "#facc15"];

/**
 * Threshold-based bar colors for latency values (ms).
 */
const barColorThresholds: [number, string][] = [
  [50, "#5eead4"],
  [100, "#facc15"],
  [200, "#f97316"],
  [Infinity, "#ef4444"],
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
    // Target ~60-200 bars for readability (more for short ranges, fewer for long ranges)
    const targetBarCount = Math.max(60, Math.min(200, Math.round(rangeMs / 1_000)));
    const bucketMs = getBucketSize(rangeMs, totalPointCount, targetBarCount);
    const aggregated = aggregateData(history, bucketMs);
    const { data, labels } = alignSeries(aggregated);
    const width = Math.max(280, this.container.clientWidth);
    const height = Math.max(this.options.compact ? 80 : 260, this.container.clientHeight);
    const intervals = this.intervalsForDisplay(history);

    // Line mode: used when all monitors are visible (no single target selected) and not compact.
    // Bar mode: used when a single monitor is selected or in compact view.
    const isLineMode = !this.options.compact && !this.selectedTargetId;

    // Build bar path builder only in bar mode
    const barsPath = isLineMode
      ? undefined
      : ((uPlot.paths as any)?.bars ?? (() => () => ({ stroke: null, fill: null, clip: null }))())({
          size: [0.8, Math.max(3, Math.min(12, width / Math.max(1, data[0].length))), 1],
          gap: 1,
          radius: [0.5, 0.5],
          disp: {
            fill: {
              unit: 3 as uPlot.Series.BarsPathBuilderFacetUnit,
              values: (_self: uPlot, seriesIdx: number, _idx0: number, _idx1: number) => {
                const result: (string | null)[] = [];
                for (let i = 0; i < data[seriesIdx].length; i++) {
                  const value = data[seriesIdx][i];
                  result.push(value == null ? null : barColor(value as number));
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
            const ceiling = niceCeiling(Math.max(50, (max || 50) * 1.15));
            return [0, ceiling];
          },
        },
      },
      series,
      axes: this.options.compact
        ? [{ show: false }, { show: false }]
        : [
            {
              space: 40,
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
              size: 40,
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
        setCursor: [(u) => this.updateTooltip(u, labels, intervals)],
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

  private updateTooltip(
    plot: uPlot,
    labels: string[],
    intervals: QualityIntervalRecord[],
  ): void {
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
    const interval = intervals.find(
      (item) => timestampMs >= item.startMs && timestampMs <= (item.endMs ?? this.history!.toMs),
    );
    const intervalText = interval
      ? `<div class="tooltip-state state-${interval.state}">${stateLabel(interval.state)}</div>`
      : "";
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
} {
  const timestamps = Array.from(
    new Set(history.series.flatMap((series) => series.points.map((point) => point.timestampMs))),
  ).sort((a, b) => a - b);
  if (timestamps.length === 0) timestamps.push(history.fromMs, history.toMs);
  const data: uPlot.AlignedData = [timestamps.map((timestamp) => timestamp / 1_000)];
  for (const series of history.series) {
    const values = new Map(
      series.points.map((point) => [point.timestampMs, point.averageLatencyMs] as const),
    );
    data.push(timestamps.map((timestamp) => values.get(timestamp) ?? null));
  }
  return { data, labels: history.series.map((series) => series.target.name) };
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
 * Returns a clean ceiling value for the Y axis (e.g. 10, 20, 25, 50, 100, 200, 250, 500, 1000).
 */
function niceCeiling(value: number): number {
  if (value <= 0) return 10;
  const magnitude = Math.pow(10, Math.floor(Math.log10(value)));
  const normalized = value / magnitude;
  const steps = [1, 2, 2.5, 5, 10, 20, 25, 50, 100];
  for (const step of steps) {
    if (step >= normalized) return step * magnitude;
  }
  return steps[steps.length - 1] * magnitude;
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
