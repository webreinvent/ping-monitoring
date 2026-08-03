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
  /** Horizontal threshold line Y value (in ms) */
  thresholdValue?: number | null;
}

const props = withDefaults(defineProps<Props>(), {
  height: 300,
  qualityBands: () => [],
  thresholdValue: null,
});

const wrapperRef = ref<HTMLDivElement>();
let chart: uPlot | null = null;

function buildOptions(): Record<string, unknown> {
  const seriesConfig = props.seriesConfig ?? [];
  const bands = props.qualityBands;
  const threshold = props.thresholdValue;

  // Build series array: time + data series + optional threshold
  const series: uPlot.Series[] = [
    {
      label: "Time",
    },
    ...seriesConfig,
  ];

  if (threshold != null) {
    series.push({
      label: `Threshold (${threshold}ms)`,
      stroke: "rgba(239, 68, 68, 0.6)",
      width: 1,
      dash: [8, 4],
      points: { show: false },
      spanGaps: true,
    });
  }

  const opts: Record<string, unknown> = {
    title: "Latency",
    scales: {
      x: {},
      y: {},
    },
    series,
    axes: [
      {
        // x-axis
        stroke: "rgba(148, 176, 194, 0.25)",
        font: "11px Inter, ui-sans-serif, system-ui, sans-serif",
        values: () => [],
      },
      {
        // y-axis
        stroke: "rgba(148, 176, 194, 0.25)",
        font: "11px Inter, ui-sans-serif, system-ui, sans-serif",
        size: 50,
        side: 0,
      },
    ],
    cursor: {
      x: true,
      y: true,
      points: {
        size: 4,
        fill: "rgba(69, 223, 194, 0.1)",
        stroke: "#45dfc2",
      },
      drag: {
        setScale: true,
      },
    },
  };

  // Add hooks for quality bands and threshold lines
  // uPlot hooks are not fully typed — we cast at the call site
  opts.hooks = [
    function (u: any) {
      // Draw quality interval bands on the chart's canvas
      if (!bands || bands.length === 0) return;
      u.addHook("drawClear", () => {
        const ctx: CanvasRenderingContext2D | null = u.ctx;
        const { bbox, scale, toLeft } = u;
        const xScale = scale["x"];

        if (!xScale || !ctx) return;

        for (const band of bands) {
          const x0 = toLeft(xScale, band.start);
          const x1 = toLeft(xScale, band.end);

          if (x0 >= bbox.width || x1 < 0) continue;

          const xStart = Math.max(0, x0);
          const xEnd = Math.min(bbox.width, x1);

          ctx.save();
          ctx.globalAlpha = 1;
          ctx.fillStyle = band.color;
          ctx.fillRect(
            xStart,
            bbox.top,
            xEnd - xStart,
            bbox.height,
          );
          ctx.restore();
        }
      });

      // Draw threshold line
      if (threshold != null) {
        u.addHook("drawClear", () => {
          const ctx: CanvasRenderingContext2D | null = u.ctx;
          if (!ctx) return;
          const { bbox, scale, toBottom } = u;
          const yScale = scale["y"];
          if (!yScale) return;
          const y = toBottom(yScale, threshold);
          if (y < bbox.top || y > bbox.top + bbox.height) return;

          ctx.save();
          ctx.strokeStyle = "rgba(239, 68, 68, 0.6)";
          ctx.lineWidth = 1;
          ctx.setLineDash([8, 4]);
          ctx.beginPath();
          ctx.moveTo(0, y);
          ctx.lineTo(bbox.width, y);
          ctx.stroke();
          ctx.restore();
        });
      }
    },
  ];

  return opts;
}

function initChart(): void {
  if (!wrapperRef.value) return;

  const width = wrapperRef.value.clientWidth ?? 800;

  if (width === 0) return;

  // uPlot hooks are not fully typed — cast options to bypass type check
  const opts = {
    ...buildOptions(),
    width: width as number,
    height: props.height,
  } as unknown as uPlot.Options;

  chart = new uPlot(opts, props.data, wrapperRef.value);
}

function updateChart(): void {
  if (chart) {
    chart.setData(props.data);
  }
}

// Initialize on mount (client-side only)
let resizeObserver: ResizeObserver | null = null;

onMounted(() => {
  nextTick(() => {
    initChart();
  });

  if (wrapperRef.value) {
    resizeObserver = new ResizeObserver(() => {
      if (chart && wrapperRef.value) {
        const width = wrapperRef.value.clientWidth;
        if (width > 0) {
          chart.setSize({ width, height: props.height });
        }
      }
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
